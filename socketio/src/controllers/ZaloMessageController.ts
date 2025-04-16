import { Socket } from 'socket.io';
import { BaseMessageController } from './BaseMessageController';
import logger from '../utils/logger';

/**
 * Interface cho dữ liệu Zalo message
 */
export interface ZaloMessageData {
  roomId: string;   // ID của phòng để broadcast
  exceptId?: string; // ID của socket cần loại trừ khi broadcast
  message?: string;  // Nội dung tin nhắn gốc
  data?: any;       // Dữ liệu bổ sung (nếu có)
}

/**
 * Controller xử lý message từ Zalo OA
 */
export class ZaloMessageController extends BaseMessageController<ZaloMessageData> {
  
  /**
   * Xử lý tin nhắn Zalo
   */
  handleMessage(socket: Socket, data: ZaloMessageData): void {
    // Validate dữ liệu
    if (!this.validateData(data)) {
      logger.warn(`Invalid Zalo message data received from ${socket.id}`, { data });
      return;
    }
    
    const { roomId, exceptId, message, data: additionalData } = data;
    this.logMessageReceived(socket, data);
    
    // Broadcast tin nhắn đến tất cả client trong room trừ exceptId
    if (exceptId) {
      // Broadcast đến tất cả client trong room trừ exceptId
      socket.to(roomId).except(exceptId).emit('message:zalo', data);
      logger.info(`Message broadcasted to room ${roomId} except ${exceptId} (Instance: ${this.instanceId})`);
    } else {
      // Broadcast đến tất cả client trong room
      socket.to(roomId).emit('message:zalo', data);
      logger.info(`Message broadcasted to all clients in room ${roomId} (Instance: ${this.instanceId})`);
    }
  }

  /**
   * Kiểm tra dữ liệu đầu vào
   */
  validateData(data: ZaloMessageData): boolean {
    return Boolean(data.roomId);
  }

  /**
   * Lấy tên sự kiện
   */
  getEventName(): string {
    return 'message:zalo';
  }
} 