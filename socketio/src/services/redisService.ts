import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import Redis, { Cluster, RedisOptions, ClusterOptions } from 'ioredis';
import { env } from '../config/env';
import logger from '../utils/logger';

/**
 * Redis Service
 * 
 * IMPORTANT NOTES FOR FUTURE DEVELOPMENT:
 * 
 * 1. Redis Cluster Key Management:
 *    - Trong Redis Cluster, các key được phân phối vào các slot dựa trên hash của key
 *    - Khi làm việc với Cluster, luôn sử dụng Redis Hash thay vì nhiều key riêng lẻ
 *    - Sử dụng cùng prefix cho key liên quan: 'socket:clients:*', 'users:sessions:*'
 *    - Dùng {hash_tag} để đảm bảo keys nằm trên cùng slot: 'user:{id}:profile'
 * 
 * 2. Pipeline Compatibility:
 *    - KHÔNG sử dụng pipeline cho các key không liên quan trong Redis Cluster
 *    - Kiểm tra slot của key với lệnh: CLUSTER KEYSLOT "your:key"
 *    - Redis Hash là giải pháp tối ưu để lưu trữ nhiều giá trị trong cùng một slot
 * 
 * 3. Memory Optimization:
 *    - Redis Hash tiết kiệm bộ nhớ hơn nhiều key riêng lẻ 
 *    - Luôn đặt TTL cho các key để tránh memory leak
 *    - Dùng HMGET/HMSET thay vì nhiều lệnh HGET/HSET riêng lẻ
 * 
 * @see https://redis.io/topics/cluster-spec
 * @see https://github.com/redis/node-redis
 */
export class RedisService {
  private pubClient!: Redis | Cluster;
  private subClient!: Redis | Cluster;
  private isClusterMode: boolean;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 20;

  constructor() {
    this.isClusterMode = env.REDIS.MODE === 'cluster';
    
    // Initialize Redis clients based on the configured mode
    if (this.isClusterMode) {
      this.initializeCluster();
    } else {
      this.initializeStandalone();
    }

    // Set up event handlers for connection issues
    this.setupEventHandlers();

    logger.info(`[Redis service initialized in ${this.isClusterMode ? 'cluster' : 'standalone'} mode`);
  }

  private getRetryStrategy(times: number): number | null {
    this.reconnectAttempts = times;
    
    if (times > this.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`[Redis connection failed after ${times} attempts. Giving up.`);
      return null; // stop retrying
    }
    
    const delay = Math.min(100 + times * 2, 2000);
    logger.debug(`[Redis retry attempt: ${times}, delay: ${delay}ms`);
    return delay;
  }

  private initializeStandalone(): void {
    const options: RedisOptions = {
      host: env.REDIS.HOST,
      port: env.REDIS.PORT,
      username: env.REDIS.USERNAME || undefined,
      password: env.REDIS.PASSWORD || undefined,
      retryStrategy: this.getRetryStrategy.bind(this),
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // reconnect on READONLY error
        }
        return false;
      }
    };

    // Initialize standalone Redis clients
    this.pubClient = new Redis(options);
    this.subClient = this.pubClient.duplicate();
  }

  private initializeCluster(): void {
    const nodes = env.REDIS.NODES;
    const options: ClusterOptions = {
      redisOptions: {
        username: env.REDIS.USERNAME || undefined,
        password: env.REDIS.PASSWORD || undefined,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
      },
      // dnsLookup: (address, callback) => callback(null, address),
      clusterRetryStrategy: this.getRetryStrategy.bind(this),
      scaleReads: 'slave', // optional: 'master' | 'slave' | 'all'
      enableReadyCheck: true,
      slotsRefreshTimeout: 5000,
      slotsRefreshInterval: 5000,
      maxRedirections: 3,
      retryDelayOnFailover: 1000
    };

    logger.info(`Initializing Redis Cluster with nodes: ${JSON.stringify(nodes)}`);

    // Initialize cluster Redis clients independently
    this.pubClient = new Redis.Cluster(nodes, options);
    // this.subClient = this.pubClient.duplicate();
    // Create subClient with same config but independent connection - xai cai nay cho chac.
    this.subClient = new Redis.Cluster(nodes, {
      ...options,
      lazyConnect: true // Prevent immediate connection until needed
    });
  }

  private setupEventHandlers(): void {
    const setupClientEvents = (client: Redis | Cluster, type: 'Pub' | 'Sub') => {
      client.on('error', (err) => {
        logger.error(`[Redis ${type}] Client Error: ${err.message}`, { error: err });
      });

      client.on('connect', () => {
        this.reconnectAttempts = 0; // Reset counter on successful connection
        logger.info(`[Redis ${type}] Client connected`);
      });

      client.on('ready', () => {
        logger.info(`[Redis ${type}] Client ready`);
      });

      client.on('close', () => {
        logger.warn(`[Redis ${type}] Client connection closed`);
      });

      client.on('reconnecting', (delay: number) => {
        logger.warn(`[Redis ${type}] Client reconnecting in ${delay}ms...`);
      });

      client.on('end', () => {
        logger.warn(`[Redis ${type}] Client connection ended`);
      });
    };

    setupClientEvents(this.pubClient, 'Pub');
    setupClientEvents(this.subClient, 'Sub');

    // Cluster-specific events
    if (this.isClusterMode) {
      const pubCluster = this.pubClient as Cluster;
      const subCluster = this.subClient as Cluster;

      const setupClusterEvents = (cluster: Cluster, type: 'Pub' | 'Sub') => {
        cluster.on('node error', (err, node) => {
          logger.error(`[Redis ${type}] Cluster Node Error: ${err.message}`, { 
            error: err, 
            node: `${node.options.host}:${node.options.port}` 
          });
        });

        cluster.on('+node', (node) => {
          logger.info(`[Redis ${type}] Cluster: node added`, {
            node: `${node.options.host}:${node.options.port}`
          });
        });

        cluster.on('-node', (node) => {
          logger.info(`[Redis ${type}] Cluster: node removed`, {
            node: `${node.options.host}:${node.options.port}`
          });
        });
      };

      setupClusterEvents(pubCluster, 'Pub');
      setupClusterEvents(subCluster, 'Sub');
    }
  }

  /**
   * Create and set up Redis adapter for Socket.IO
   */
  public setupAdapter(io: Server): void {
    try {
      const adapter = createAdapter(this.pubClient, this.subClient);
      io.adapter(adapter);
      logger.info('Socket.IO Redis adapter set up successfully');
    } catch (error) {
      logger.error('Failed to set up Socket.IO Redis adapter', { error });
      throw error;
    }
  }

  /**
   * Get the Redis publisher client for custom operations
   */
  public getPubClient(): Redis | Cluster {
    return this.pubClient;
  }

  /**
   * Get the Redis subscriber client for custom operations
   */
  public getSubClient(): Redis | Cluster {
    return this.subClient;
  }

  /**
   * Store data in Redis
   */
  public async set(key: string, value: string, expiryInSeconds?: number): Promise<void> {
    try {
      if (expiryInSeconds) {
        await this.pubClient.set(key, value, 'EX', expiryInSeconds);
      } else {
        await this.pubClient.set(key, value);
      }
    } catch (error) {
      logger.error(`[Redis set error: ${error}`, { key, error });
      throw error;
    }
  }

  /**
   * Retrieve data from Redis
   */
  public async get(key: string): Promise<string | null> {
    try {
      return await this.pubClient.get(key);
    } catch (error) {
      logger.error(`[Redis get error: ${error}`, { key, error });
      throw error;
    }
  }

  /**
   * Close Redis connections
   */
  public async close(): Promise<void> {
    await this.pubClient.quit();
    await this.subClient.quit();
    logger.info('Redis connections closed');
  }

  public async sadd(key: string, value: string): Promise<number> {
    return this.pubClient.sadd(key, value);
  }

  /**
   * Set expiration time for a key
   */
  public async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.pubClient.expire(key, seconds);
    } catch (error) {
      logger.error(`[Redis expire error: ${error}`, { key, seconds, error });
      throw error;
    }
  }

  /**
   * Remove a member from a Redis Set
   */
  public async srem(key: string, member: string): Promise<number> {
    try {
      return await this.pubClient.srem(key, member);
    } catch (error) {
      logger.error(`[Redis srem error: ${error}`, { key, member, error });
      throw error;
    }
  }

  /**
   * Delete one or more keys
   */
  public async del(key: string | string[]): Promise<number> {
    try {
      if (Array.isArray(key)) {
        // Nếu là mảng các key
        return await this.pubClient.del(...key);
      } else {
        // Nếu là một key đơn
        return await this.pubClient.del(key);
      }
    } catch (error) {
      logger.error(`[Redis del error: ${error}`, { key, error });
      throw error;
    }
  }

  /**
   * Get all members of a set
   */
  public async smembers(key: string): Promise<string[]> {
    try {
      return await this.pubClient.smembers(key);
    } catch (error) {
      logger.error(`[Redis smembers error: ${error}`, { key, error });
      throw error;
    }
  }

  /**
   * Create a pipeline for batch operations
   * Returns a Pipeline instance that works with both standalone and cluster mode
   */
  public pipeline(): any {
    if (this.isClusterMode) {
      // Redis cluster uses a different pipeline mechanism
      return (this.pubClient as Cluster).pipeline();
    } else {
      // Standalone Redis pipeline
      return (this.pubClient as Redis).pipeline();
    }
  }

  /**
   * Get a field from a Redis Hash
   */
  public async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.pubClient.hget(key, field);
    } catch (error) {
      logger.error(`[Redis hget error: ${error}`, { key, field, error });
      throw error;
    }
  }

  /**
   * Set a field in a Redis Hash
   */
  public async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.pubClient.hset(key, field, value);
    } catch (error) {
      logger.error(`[Redis hset error: ${error}`, { key, field, error });
      throw error;
    }
  }

  /**
   * Get all fields and values from a Redis Hash
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.pubClient.hgetall(key);
    } catch (error) {
      logger.error(`[Redis hgetall error: ${error}`, { key, error });
      throw error;
    }
  }

  /**
   * Get multiple fields from a Redis Hash
   */
  public async hmget(key: string, fields: string[]): Promise<(string | null)[]> {
    try {
      return await this.pubClient.hmget(key, ...fields);
    } catch (error) {
      logger.error(`[Redis hmget error: ${error}`, { key, fields, error });
      throw error;
    }
  }

  /**
   * Delete a field from a Redis Hash
   */
  public async hdel(key: string, field: string): Promise<number> {
    try {
      return await this.pubClient.hdel(key, field);
    } catch (error) {
      logger.error(`[Redis hdel error: ${error}`, { key, field, error });
      throw error;
    }
  }

  /**
   * Increment a field in a Redis Hash
   */
  public async hincrby(key: string, field: string, increment: number): Promise<number> {
    try {
      return await this.pubClient.hincrby(key, field, increment);
    } catch (error) {
      logger.error(`[Redis hincrby error: ${error}`, { key, field, increment, error });
      throw error;
    }
  }
} 