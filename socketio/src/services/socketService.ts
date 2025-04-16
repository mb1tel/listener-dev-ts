import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';
import { RedisService } from './redisService';
import { env } from '../config/env';
import { socketAuthMiddleware } from '../middleware/authMiddleware';
import { MessageControllerFactory } from '../controllers';
import { Message } from '../types/message';

/**
 * Socket.IO Service
 * 
 * IMPORTANT NOTES FOR FUTURE DEVELOPMENT:
 * 
 * 1. Redis Integration Best Practices:
 *    - Tất cả dữ liệu instance nên lưu trong Redis Hash
 *    - Sử dụng key cố định 'socket:clients:counts' thay vì keys động
 *    - Đảm bảo heartbeat và timeout phù hợp
 * 
 * 2. Scaling Best Practices:
 *    - INSTANCE_ID trong Docker Compose được tự động gán = HOSTNAME  
 *    - Mỗi instance chỉ theo dõi client count của instance đó
 *    - Adapter tự động xử lý broadcast message giữa các instances
 * 
 * 3. Error Handling:
 *    - Redis connection failure được xử lý với reconnect
 *    - Dead instance detection với timeout 60 giây
 *    - Mỗi operation Redis đều có try/catch riêng
 *
 * 4. Memory Management:
 *    - Set TTL cho tất cả Redis keys (40 giây) để tránh memory leak
 *    - Dọn dẹp các client khi disconnect
 *    - Rate limit cho client count broadcast
 */

export class SocketService {
  private io: Server;
  private redisService: RedisService;
  private instanceId: string;
  private clientCount: number = 0;
  private roomClients: Map<string, Set<string>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  // Throttle settings for broadcasts
  private broadcastThrottleTime = 1000; // 1 second
  private lastBroadcastTime = 0;
  private pendingBroadcast = false;

  constructor(server: HTTPServer) {
    this.instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || `dev-${Date.now()}`;
    this.io = new Server(server, {
      path: "/listener", // Đổi path theo FE
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 30000,
      pingInterval: 25000,
      serveClient: true
    });

    // Initialize Redis service and set up adapter
    this.redisService = new RedisService();
    this.redisService.setupAdapter(this.io);
    
    // Use authentication middleware
    this.io.use(socketAuthMiddleware);

    // Khởi tạo MessageControllerFactory
    MessageControllerFactory.initialize(this.io, this.instanceId);
    
    this.setupEventHandlers();
    
    // Register this instance and start heartbeat
    this.registerInstance()
      .then(() => {
        // Start regular updates after successful registration
        this.startClientCountUpdates();
        this.startInstanceHeartbeat();
      })
      .catch(err => {
        logger.error(`Failed to register instance: ${err.message}`, { error: err });
        // Try again in 5 seconds
        setTimeout(() => this.registerInstance(), 5000);
      });
    
    logger.info(`Socket.IO service initialized (Instance ID: ${this.instanceId})`);
  }

  /**
   * Register this instance in Redis with expiration
   */
  private async registerInstance(): Promise<void> {
    try {
      // Sử dụng Redis Hash để lưu trữ client counts và last updates - đảm bảo cùng slot
      const countKey = 'socket:clients:counts';
      const lastUpdateKey = 'socket:clients:lastUpdate';

      // Thêm instance vào set
      await this.redisService.sadd('socket:instances', this.instanceId);
      
      // Set initial client count trong hash
      await this.redisService.hset(countKey, this.instanceId, '0');
      
      // Set last update trong hash
      await this.redisService.hset(lastUpdateKey, this.instanceId, Date.now().toString());
      
      // Set expiration trên toàn bộ keys
      await this.redisService.expire(countKey, 40);
      await this.redisService.expire(lastUpdateKey, 40);
      
      logger.info(`Instance ${this.instanceId} registered successfully`);
    } catch (error) {
      logger.error('Error registering instance in Redis', { error });
      throw error;
    }
  }

  /**
   * Start instance heartbeat to keep registration alive
   */
  private startInstanceHeartbeat(): void {
    // Clear any existing interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      try {
        const countKey = 'socket:clients:counts';
        const lastUpdateKey = 'socket:clients:lastUpdate';
        
        // Refresh instance data and expiration sử dụng Redis Hash
        await this.redisService.hset(countKey, this.instanceId, this.clientCount.toString());
        await this.redisService.hset(lastUpdateKey, this.instanceId, Date.now().toString());
        
        // Refresh expiration cho toàn bộ hash
        await this.redisService.expire(countKey, 40);
        await this.redisService.expire(lastUpdateKey, 40);
      } catch (error) {
        logger.error('Error in instance heartbeat', { error });
      }
    }, 30000); // 30 seconds
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    const clientId = socket.id;
    
    // Increment client count
    this.clientCount++;
    this.updateClientCountInRedis().catch(err => {
      logger.error(`Failed to update client count: ${err.message}`, { error: err });
    });
    
    this.throttledBroadcastClientCount();
    
    logger.info(`Client connected: ${clientId} (Instance: ${this.instanceId}, Total clients: ${this.clientCount})`);

    // Handle join room event
    socket.on('join-room', (roomId: string) => {
      this.handleJoinRoom(socket, roomId);
    });

    // Thiết lập event handlers bằng các controllers
    const controllers = MessageControllerFactory.getAllControllers();
    controllers.forEach((controller, eventName) => {
      socket.on(eventName, (data) => {
        controller.handleMessage(socket, data);
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  private handleJoinRoom(socket: Socket, roomId: string): void {
    socket.join(roomId);
    
    // Track clients in room
    if (!this.roomClients.has(roomId)) {
      this.roomClients.set(roomId, new Set());
    }
    this.roomClients.get(roomId)?.add(socket.id);
    
    logger.info(`Client ${socket.id} joined room: ${roomId} (Instance: ${this.instanceId})`);
    
    // Store client data in Redis for cross-instance tracking
    this.storeClientData(socket.id, roomId).catch(err => {
      logger.error(`Failed to store client data: ${err.message}`, { error: err });
    });
  }

  private async storeClientData(clientId: string, roomId: string): Promise<void> {
    try {
      const key = `client:${clientId}`;
      const value = JSON.stringify({
        roomId,
        instanceId: this.instanceId,
        connectedAt: new Date().toISOString()
      });
      
      // Store with 1 day expiry (or shorter if needed)
      await this.redisService.set(key, value, 86400);
    } catch (error) {
      logger.error('Error storing client data in Redis', { error });
      throw error;
    }
  }

  /**
   * Method to broadcast a message to a specific room
   * This can be called from other services (e.g., webhook handler)
   */
  public broadcastToRoom(roomId: string, message: Message): void {
    if (!roomId || !message) {
      logger.warn('Invalid parameters for broadcastToRoom', { roomId, message });
      return;
    }
    
    this.io.to(roomId).emit('message', message);
    logger.info(`Message broadcasted to room ${roomId} (Instance: ${this.instanceId})`);
  }
  
  /**
   * Update client count in Redis with proper error handling
   */
  private async updateClientCountInRedis(): Promise<void> {
    try {
      const countKey = 'socket:clients:counts';
      const lastUpdateKey = 'socket:clients:lastUpdate';
      
      // Lưu trữ client count và last update trong Redis Hash
      await this.redisService.hset(countKey, this.instanceId, this.clientCount.toString());
      await this.redisService.hset(lastUpdateKey, this.instanceId, Date.now().toString());
      
      // Refresh expiration
      await this.redisService.expire(countKey, 40);
      await this.redisService.expire(lastUpdateKey, 40);
    } catch (error) {
      logger.error('Error updating client count in Redis', { error });
      throw error;
    }
  }
  
  /**
   * Start regular client count updates
   */
  private startClientCountUpdates(): void {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Update every 15 seconds (increased from 10s to reduce Redis load)
    this.updateInterval = setInterval(() => {
      this.getTotalClientCount()
        .then(count => {
          this.throttledBroadcastClientCount(count);
        })
        .catch(err => {
          logger.error(`Failed to get total client count: ${err.message}`, { error: err });
        });
    }, 15000);
  }
  
  /**
   * Clean up resources when service is shutting down
   */
  public async shutdown(): Promise<void> {
    logger.info(`Socket service shutting down (Instance: ${this.instanceId})`);
    
    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    try {
      // Dọn dẹp Redis khi shutdown
      await this.redisService.srem('socket:instances', this.instanceId);
      
      // Xóa instance khỏi Redis Hash
      await this.redisService.hdel('socket:clients:counts', this.instanceId);
      await this.redisService.hdel('socket:clients:lastUpdate', this.instanceId);
      
      // Close Socket.IO server
      await new Promise<void>((resolve) => {
        this.io.close(() => {
          logger.info('Socket.IO server closed');
          resolve();
        });
      });
    } catch (error) {
      logger.error('Error during socket service shutdown', { error });
    }
  }
  
  /**
   * Get total client count across all instances
   * Phiên bản cải tiến sử dụng Redis Hash để tương thích với Redis Cluster
   * 
   * IMPORTANT:
   * - Sử dụng Redis Hash thay vì pipeline để tương thích với Redis Cluster
   * - Trong Redis Cluster, các keys thuộc các slot khác nhau không thể được xử lý
   *   cùng lúc trong một pipeline transaction
   * - Sử dụng 2 hash key cố định (socket:clients:*) đảm bảo chúng ở cùng slot
   * - Redis Hash cho phép lấy nhiều field với một lệnh HGETALL
   * - Hoạt động tốt với cả Redis Standalone và Cluster mode
   */
  private async getTotalClientCount(): Promise<number> {
    try {
      let total = 0;
      const countKey = 'socket:clients:counts';
      const lastUpdateKey = 'socket:clients:lastUpdate';
      
      // Lấy tất cả instance IDs từ Redis Set
      const instanceIds = await this.redisService.smembers('socket:instances');
      
      if (instanceIds.length === 0) {
        return this.clientCount; // Return local client count if no instances found
      }

      // Lấy tất cả giá trị từ Redis Hash
      const allCounts = await this.redisService.hgetall(countKey);
      const allLastUpdates = await this.redisService.hgetall(lastUpdateKey);
      
      // Duyệt qua các instance và tính tổng số client
      for (const instanceId of instanceIds) {
        const count = allCounts[instanceId];
        const lastUpdate = allLastUpdates[instanceId];
        
        if (count && lastUpdate) {
          // Kiểm tra heartbeat, bỏ qua instance không hoạt động quá 60 giây
          if (Date.now() - parseInt(lastUpdate, 10) < 60000) {
            total += parseInt(count, 10);
          } else {
            logger.debug(`Instance with outdated heartbeat detected: ${instanceId}`);
          }
        }
      }
      
      return total;
    } catch (error) {
      logger.error('Error getting total client count', { error });
      throw error;
    }
  }
  
  /**
   * Throttled broadcast to avoid flooding clients with updates
   */
  private throttledBroadcastClientCount(totalCount?: number): void {
    const now = Date.now();
    
    // If enough time has passed since last broadcast, send immediately
    if (now - this.lastBroadcastTime >= this.broadcastThrottleTime) {
      this.lastBroadcastTime = now;
      this.pendingBroadcast = false;
      this.broadcastClientCount(totalCount);
      return;
    }
    
    // Otherwise queue a broadcast if not already pending
    if (!this.pendingBroadcast) {
      this.pendingBroadcast = true;
      
      // Schedule broadcast for later
      setTimeout(() => {
        this.pendingBroadcast = false;
        this.lastBroadcastTime = Date.now();
        this.getTotalClientCount()
          .then(count => this.broadcastClientCount(count))
          .catch(err => logger.error('Failed to get client count for delayed broadcast', { error: err }));
      }, this.broadcastThrottleTime - (now - this.lastBroadcastTime));
    }
  }
  
  /**
   * Broadcast client count to all connected clients
   */
  private broadcastClientCount(totalCount?: number): void {
    const count = totalCount ?? this.clientCount;
    this.io.emit('client-count-update', count);
  }

  private handleDisconnect(socket: Socket): void {
    // Decrement client count
    this.clientCount = Math.max(0, this.clientCount - 1);
    this.updateClientCountInRedis().catch(err => {
      logger.error(`Failed to update client count on disconnect: ${err.message}`, { error: err });
    });
    
    this.throttledBroadcastClientCount();
    
    // Remove client from tracked rooms
    this.roomClients.forEach((clients, roomId) => {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        // Remove room entry if empty
        if (clients.size === 0) {
          this.roomClients.delete(roomId);
        }
        logger.info(`Removed client ${socket.id} from room ${roomId}`);
      }
    });
    
    logger.info(`Client disconnected: ${socket.id} (Instance: ${this.instanceId}, Total clients: ${this.clientCount})`);
  }
}