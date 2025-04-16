import { Socket } from 'socket.io';
import { BaseMessageController } from './BaseMessageController';
import logger from '../utils/logger';
import { Message } from '../types/message';

/**
 * Interface cho dữ liệu message thông thường
 */
export interface DefaultMessageData {
  roomId: string;
  message: string;
  sender?: string;
}

/**
 * Controller xử lý message thông thường
 */
export class DefaultMessageController extends BaseMessageController<DefaultMessageData> {
  
  /**
   * Xử lý tin nhắn thông thường
   */
  handleMessage(socket: Socket, data: DefaultMessageData): void {
    // Validate dữ liệu
    if (!this.validateData(data)) {
      logger.warn(`Invalid message data received from ${socket.id}`, { data });
      return;
    }
    
    const { roomId, message, sender } = data;
    this.logMessageReceived(socket, data);
    
    // Tạo dữ liệu tin nhắn
    const messageData: Message = {
      id: Date.now(),
      text: message,
      sender: sender || 'Anonymous',
      timestamp: new Date().toISOString(),
      roomId,
    };
    
    // Broadcast tin nhắn đến tất cả client trong room 
    // Redis adapter sẽ tự động broadcast tới các instance khác
    this.io.to(roomId).emit('message', messageData);
  }

  /**
   * Kiểm tra dữ liệu đầu vào
   */
  validateData(data: DefaultMessageData): boolean {
    return Boolean(data.roomId && typeof data.message === 'string');
  }

  /**
   * Lấy tên sự kiện
   */
  getEventName(): string {
    return 'message';
  }

  /**
   * Log chi tiết hơn cho message
   */
  protected logMessageReceived(socket: Socket, data: DefaultMessageData): void {
    const { roomId, message } = data;
    const truncatedMessage = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    logger.info(`Message received in room ${roomId}: ${truncatedMessage} (Instance: ${this.instanceId})`);
  }
} 