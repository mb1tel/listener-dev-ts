import { Server } from 'socket.io';
import { BaseMessageController } from './BaseMessageController';
import { DefaultMessageController } from './DefaultMessageController';
import { ZaloMessageController } from './ZaloMessageController';

/**
 * Factory class để tạo và quản lý các controllers
 */
export class MessageControllerFactory {
  private static controllers: Map<string, BaseMessageController> = new Map();

  /**
   * Khởi tạo tất cả controllers
   */
  static initialize(io: Server, instanceId: string): void {
    // Đăng ký các controllers
    this.registerController(new DefaultMessageController(io, instanceId));
    this.registerController(new ZaloMessageController(io, instanceId));
    
    // Có thể đăng ký thêm các controller khác ở đây
  }

  /**
   * Đăng ký một controller
   */
  static registerController(controller: BaseMessageController): void {
    this.controllers.set(controller.getEventName(), controller);
  }

  /**
   * Lấy controller theo tên sự kiện
   */
  static getController(eventName: string): BaseMessageController | undefined {
    return this.controllers.get(eventName);
  }

  /**
   * Lấy tất cả controller đã đăng ký
   */
  static getAllControllers(): Map<string, BaseMessageController> {
    return this.controllers;
  }
}

// Export các controller classes cho việc sử dụng cụ thể
export { BaseMessageController } from './BaseMessageController';
export { DefaultMessageController } from './DefaultMessageController';
export { ZaloMessageController } from './ZaloMessageController';
export type { DefaultMessageData } from './DefaultMessageController';
export type { ZaloMessageData } from './ZaloMessageController'; 