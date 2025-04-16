import { Socket } from 'socket.io';
import { Server } from 'socket.io';
import logger from '../utils/logger';

/**
 * Base abstract class cho tất cả message controllers
 * Định nghĩa interface chung cho việc xử lý tin nhắn
 */
export abstract class BaseMessageController<T = any> {
  protected io: Server;
  protected instanceId: string;

  constructor(io: Server, instanceId: string) {
    this.io = io;
    this.instanceId = instanceId;
  }

  /**
   * Xử lý tin nhắn nhận được
   * @param socket Socket đang kết nối
   * @param data Dữ liệu tin nhắn
   */
  abstract handleMessage(socket: Socket, data: T): void | Promise<void>;

  /**
   * Lấy tên của sự kiện mà controller này xử lý
   */
  abstract getEventName(): string;

  /**
   * Kiểm tra dữ liệu đầu vào
   * @param data Dữ liệu cần kiểm tra
   */
  abstract validateData(data: T): boolean;

  /**
   * Log thông tin tin nhắn nhận được
   */
  protected logMessageReceived(socket: Socket, data: any): void {
    logger.info(`[${this.getEventName()}] Received from ${socket.id} (Instance: ${this.instanceId})`);
  }
} 