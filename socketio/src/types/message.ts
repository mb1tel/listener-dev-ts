/**
 * Interface for message data
 */
export interface Message {
  id: number;
  text: string;
  sender: string;
  timestamp: string;
  roomId: string;
  metadata?: any; // Chứa dữ liệu bổ sung dành cho các loại tin nhắn đặc biệt
} 