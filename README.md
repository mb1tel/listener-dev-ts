# Socket.IO Multi-Instance Server

Dự án này triển khai một hệ thống Socket.IO phân tán chạy trên nhiều instances, sử dụng Redis làm adapter cho việc đồng bộ dữ liệu giữa các instances. Hệ thống bao gồm load balancing với Nginx và webhook server để tiếp nhận sự kiện từ bên ngoài.

## Tổng quan

Hệ thống bao gồm các thành phần sau:
- **Socket.IO Server**: 3 instances chạy độc lập
- **Redis Server**: Adapter để đồng bộ dữ liệu giữa các Socket.IO instances
- **Nginx Load Balancer**: Điều phối request đến các Socket.IO instances
- **Webhook Server**: Tiếp nhận sự kiện từ bên ngoài và chuyển tiếp đến Socket.IO server

## Cấu trúc dự án

```
/
├── docker-compose.yml        # Docker Compose cho tất cả các services
├── socketio/                 # Source code cho Socket.IO server
│   ├── src/                  # TypeScript source code
│   ├── package.json          # Node.js dependencies
│   └── Dockerfile            # Docker config cho Socket.IO service
├── nginx/                    # Cấu hình Nginx
│   ├── nginx.conf            # Cấu hình Nginx chính
│   └── conf.d/               # Cấu hình virtual hosts
├── webhook/                  # Webhook Server
│   ├── webhook-server.js     # Webhook Server code
│   └── Dockerfile            # Docker config cho Webhook service
└── public/                   # Client demo
    └── index.html            # HTML client demo
```

## Yêu cầu

- Docker và Docker Compose
- Node.js (cho phát triển local)
- npm (cho phát triển local)

## Hướng dẫn cài đặt

### Chạy với Docker Compose

1. Clone repository
```bash
git clone <repository-url>
cd socketio-multi-instance
```

2. Khởi động hệ thống với Docker Compose
```bash
docker-compose up -d
```

3. Truy cập các services:
   - Socket.IO demo client: http://localhost:3000
   - Webhook Server: http://localhost:4000

### Phát triển local (không dùng Docker)

1. Cài đặt Socket.IO server
```bash
cd socketio
npm install
npm run dev
```

2. Trong terminal khác, cài đặt Webhook server
```bash
cd webhook
npm install
npm run dev
```

## Xử lý lỗi thường gặp

### Lỗi "Cannot find module '/app/dist/server.js'"

Nếu bạn gặp lỗi này khi chạy Docker, nguyên nhân là vì các file TypeScript chưa được biên dịch thành JavaScript trong thư mục dist. Có thể giải quyết bằng các cách sau:

1. **Kiểm tra tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src",
       // Các cấu hình khác...
     }
   }
   ```

2. **Đảm bảo biên dịch trước khi chạy**
   
   Sửa lại Docker Compose để biên dịch TypeScript:
   ```yaml
   command: /bin/sh -c "npm run build && npm start"
   ```

3. **Build thủ công trước khi chạy Docker**
   ```bash
   cd socketio
   npm run build
   cd ..
   docker-compose up -d
   ```

4. **Sửa volume trong Docker Compose**
   
   Đảm bảo các volume được mount đúng cách:
   ```yaml
   volumes:
     - ./socketio/src:/app/src
     - ./socketio/package.json:/app/package.json
     - ./socketio/tsconfig.json:/app/tsconfig.json
   ```

### Lỗi kết nối Redis

Nếu các instance không thể kết nối được với Redis, kiểm tra:

1. Redis đã chạy chưa: `docker ps | grep redis`
2. Các biến môi trường đã được thiết lập đúng:
   ```
   REDIS_HOST=redis
   REDIS_PORT=6379
   ```

## Hướng dẫn test

### 1. Test thông qua Web Client

1. Mở trình duyệt và truy cập http://localhost:3000
2. Nhập một Room ID (ví dụ: "room1") và nhấn "Join Room"
3. Gửi tin nhắn vào room đó

Để kiểm tra khả năng phân tán:
1. Mở nhiều tab trình duyệt
2. Tham gia cùng một phòng ở các tab khác nhau
3. Gửi tin nhắn từ một tab và kiểm tra xem tin nhắn xuất hiện ở tất cả các tab khác

### 2. Test thông qua Webhook

Bạn có thể sử dụng curl hoặc Postman để gửi webhook đến hệ thống:

#### Sử dụng curl:

```bash
curl -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -d '{"roomId": "room1", "message": "Hello from webhook", "sender": "Webhook Test"}'
```

#### Sử dụng Postman:

1. Tạo một POST request đến http://localhost:4000/webhook
2. Thiết lập header: Content-Type: application/json
3. Thiết lập body (raw, JSON):
```json
{
  "roomId": "room1",
  "message": "Hello from webhook",
  "sender": "Webhook Test"
}
```
4. Gửi request

Tin nhắn sẽ được gửi đến tất cả clients đang tham gia phòng "room1".

### 3. Test load balancing

1. Mở nhiều tab trình duyệt
2. Truy cập vào http://localhost:3000 trên mỗi tab
3. Kiểm tra "Server Instance" ở mỗi tab - bạn sẽ thấy các kết nối được phân bố đến các instances khác nhau
4. Tham gia cùng một phòng trên các tab và kiểm tra việc truyền tin nhắn xuyên instances

### 4. Thử nghiệm độ bền

Để thử nghiệm tính bền vững của hệ thống, bạn có thể dừng một instance Socket.IO:

```bash
docker stop socketio-1
```

Các kết nối hiện tại sẽ được chuyển đến các instances còn lại, và tin nhắn vẫn sẽ được truyền đến tất cả clients.

## Các API endpoints

### Socket.IO Server

- `GET /`: Trang chủ Socket.IO Server
- `GET /health`: Kiểm tra trạng thái server

### Webhook Server

- `GET /`: Trang chủ Webhook Server
- `GET /health`: Kiểm tra trạng thái server
- `POST /webhook`: Endpoint nhận webhook

  Tham số:
  ```json
  {
    "roomId": "string",    // ID của phòng (bắt buộc)
    "message": "string",   // Nội dung tin nhắn (bắt buộc)
    "sender": "string"     // Tên người gửi (không bắt buộc)
  }
  ```

## Kiến trúc hệ thống

```
                 ┌─────────────────┐
                 │   Load Balancer │
                 └────────┬────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
┌────────▼───────┐ ┌──────▼─────────┐ ┌────▼──────────────┐
│  Socket.IO     │ │  Socket.IO     │ │  Socket.IO        │
│  Instance 1    │ │  Instance 2    │ │  Instance 3       │
└────────┬───────┘ └──────┬─────────┘ └────┬──────────────┘
         │                │                │
         └────────────────┼────────────────┘
                          │
                 ┌────────▼────────┐
                 │  Redis Adapter  │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │  Redis Server   │
                 └─────────────────┘
```

- **Load Balancer (Nginx)**: Phân phối các kết nối WebSocket đến các Socket.IO instances. Sử dụng sticky sessions (ip_hash) để đảm bảo các kết nối từ cùng một client luôn được định tuyến đến cùng một instance.

- **Socket.IO Instances**: Các instances chạy độc lập, xử lý các kết nối WebSocket. Mỗi instance có ID riêng.

- **Redis Adapter**: Đồng bộ hóa các sự kiện và dữ liệu giữa các Socket.IO instances. Khi một tin nhắn được gửi đến một instance, Redis Adapter đảm bảo rằng nó sẽ được truyền đến tất cả các clients liên quan trên tất cả các instances.

- **Webhook Server**: Tiếp nhận các sự kiện từ bên ngoài và chuyển tiếp chúng đến hệ thống Socket.IO thông qua Socket.IO client. 

## Redis Hash và Key Management trong Redis Cluster

Khi làm việc với Redis trong môi trường phân tán, đặc biệt là với Redis Cluster, có một số lưu ý quan trọng về cách quản lý và truy xuất dữ liệu hiệu quả:

### 1. Phân phối key trong Redis Cluster

Redis Cluster phân phối dữ liệu vào 16384 slots khác nhau dựa trên hash của key. Mỗi key thuộc về một slot cụ thể, và các slot được phân bổ cho các node khác nhau. Điều này có một số hệ quả quan trọng:

- **Không thể sử dụng pipeline cho các key ở các slot khác nhau**
- **Các transactions chỉ hoạt động với các key thuộc cùng một slot**

### 2. Sử dụng Redis Hash thay vì nhiều key riêng lẻ

Để khắc phục vấn đề trên và tối ưu hiệu suất, dự án này sử dụng Redis Hash thay vì nhiều key riêng lẻ:

```javascript
// Kém hiệu quả với Redis Cluster
redis.set(`clients:${instanceId}`, count);
redis.set(`clients:${instanceId}:lastUpdate`, timestamp);

// Tốt hơn, hoạt động tốt với Redis Cluster
redis.hset('socket:clients:counts', instanceId, count);
redis.hset('socket:clients:lastUpdate', instanceId, timestamp);
```

### 3. Hash Tags để đảm bảo các key khác nhau cùng slot

Nếu bạn vẫn cần sử dụng nhiều key riêng lẻ, hãy sử dụng hash tags `{tag}` để đảm bảo chúng nằm trong cùng một slot:

```javascript
// Các key này được đảm bảo nằm trong cùng một slot
redis.set(`user:{12345}:profile`, profileData);
redis.set(`user:{12345}:sessions`, sessionData);
```

### 4. Lưu ý khi sử dụng Redis Cluster

- **Kiểm tra slot của key**: Sử dụng `CLUSTER KEYSLOT "key"` để kiểm tra slot của một key
- **Timeout dài hơn**: Redis Cluster có thể cần timeout dài hơn do redirections
- **Monitoring**: Theo dõi số lượng redirects và các phép toán chậm

### 5. Memory Optimization

Redis Hash tiết kiệm memory đáng kể khi lưu trữ các cặp key-value nhỏ. Ví dụ:

- 1000 key-value riêng lẻ: ~100KB
- 1 Redis Hash với 1000 field-value: ~50KB

### 6. Chuyển đổi giữa standalone và cluster

Dự án này được thiết kế để hoạt động với cả Redis standalone và cluster. Để chuyển đổi:

```bash
# Cấu hình cho Redis Standalone (dev)
REDIS_MODE=standalone
REDIS_HOST=localhost
REDIS_PORT=6379

# Cấu hình cho Redis Cluster (production)
REDIS_MODE=cluster
REDIS_NODES=[{"host":"redis-1","port":6379},{"host":"redis-2","port":6379},{"host":"redis-3","port":6379}]
```

Các phương thức Redis Service sẽ tự động xử lý sự khác biệt giữa hai chế độ. 

## Hướng dẫn phát triển

### Thêm loại tin nhắn mới

Dự án này sử dụng kiến trúc MVC với các controller xử lý tin nhắn tách biệt, giúp dễ dàng mở rộng và thêm các loại tin nhắn mới. Dưới đây là quy trình thêm một loại tin nhắn mới:

#### 1. Định nghĩa Interface cho loại tin nhắn

Tạo interface mô tả cấu trúc dữ liệu của loại tin nhắn mới:

```typescript
// Ví dụ cho tin nhắn hình ảnh
export interface ImageMessageData {
  roomId: string;         // Required: ID của phòng
  imageUrl: string;       // Required: URL của hình ảnh
  sender?: string;        // Optional: Người gửi
  caption?: string;       // Optional: Chú thích của hình ảnh
  width?: number;         // Optional: Chiều rộng
  height?: number;        // Optional: Chiều cao
  fileSize?: number;      // Optional: Kích thước file
}
```

#### 2. Tạo Controller mới

Tạo file mới trong thư mục `controllers`, ví dụ `ImageMessageController.ts`:

```typescript
import { Socket } from 'socket.io';
import { BaseMessageController } from './BaseMessageController';
import logger from '../utils/logger';
import { Message } from '../types/message';

export class ImageMessageController extends BaseMessageController<ImageMessageData> {
  
  /**
   * Xử lý tin nhắn hình ảnh
   */
  handleMessage(socket: Socket, data: ImageMessageData): void {
    // Validate dữ liệu
    if (!this.validateData(data)) {
      logger.warn(`Invalid image message data from ${socket.id}`, { data });
      return;
    }
    
    // Xử lý tin nhắn và gửi đến các clients
    const { roomId, imageUrl, sender, caption } = data;
    
    // Tạo dữ liệu tin nhắn
    const messageData: Message = {
      id: Date.now(),
      text: caption || 'Đã gửi một hình ảnh',
      sender: sender || 'Anonymous',
      timestamp: new Date().toISOString(),
      roomId,
      metadata: {
        type: 'image',
        imageUrl,
        width: data.width,
        height: data.height,
        fileSize: data.fileSize
      }
    };
    
    // Broadcast tin nhắn
    this.io.to(roomId).emit('message:image', messageData);
    this.io.to(roomId).emit('message', messageData);
  }

  /**
   * Kiểm tra dữ liệu đầu vào
   */
  validateData(data: ImageMessageData): boolean {
    return Boolean(data.roomId && data.imageUrl);
  }

  /**
   * Lấy tên sự kiện
   */
  getEventName(): string {
    return 'message:image';
  }
}
```

#### 3. Cập nhật Message interface (nếu cần)

Nếu tin nhắn mới có metadata đặc biệt, cập nhật interface `Message` trong `types/message.ts`:

```typescript
export interface Message {
  id: number;
  text: string;
  sender: string;
  timestamp: string;
  roomId: string;
  metadata?: any; // Thêm field metadata cho thông tin bổ sung
}
```

#### 4. Đăng ký Controller trong MessageControllerFactory

Trong file `controllers/index.ts`, bổ sung phần import và đăng ký controller mới:

```typescript
import { ImageMessageController } from './ImageMessageController';

// Thêm vào phần export
export { ImageMessageController };
export type { ImageMessageData } from './ImageMessageController';

// Trong phương thức initialize
static initialize(io: Server, instanceId: string): void {
  // Các controllers đã có
  this.registerController(new DefaultMessageController(io, instanceId));
  this.registerController(new ZaloMessageController(io, instanceId));
  
  // Thêm controller mới
  this.registerController(new ImageMessageController(io, instanceId));
}
```

#### 5. Hướng dẫn xử lý trên Client

Cần cập nhật các client để lắng nghe và xử lý loại tin nhắn mới:

```javascript
// Lắng nghe sự kiện message:image cụ thể
socket.on('message:image', (data) => {
  displayImageMessage(data);
});

// Hoặc xử lý qua event message thông thường dựa trên metadata
socket.on('message', (data) => {
  if (data.metadata && data.metadata.type === 'image') {
    displayImageMessage(data);
  } else {
    displayTextMessage(data);
  }
});

// Hàm gửi tin nhắn hình ảnh
function sendImageMessage(roomId, imageUrl, caption) {
  socket.emit('message:image', {
    roomId,
    imageUrl,
    caption,
    sender: currentUser.name
  });
}
```

#### 6. Webhook integration (nếu cần)

Nếu bạn cần nhận tin nhắn kiểu mới từ webhook, cập nhật webhook handler:

```javascript
app.post('/webhook/image', (req, res) => {
  const { roomId, imageUrl, sender, caption } = req.body;
  
  // Kết nối đến Socket.IO server
  const socketClient = io(socketioUrl);
  socketClient.emit('message:image', {
    roomId,
    imageUrl,
    sender,
    caption
  });
  
  res.status(200).json({ success: true });
});
```

### Các loại tin nhắn phổ biến

Dưới đây là các mẫu các loại tin nhắn phổ biến khác có thể thêm vào hệ thống:

#### File Message
```typescript
export interface FileMessageData {
  roomId: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  sender?: string;
}
```

#### Location Message
```typescript
export interface LocationMessageData {
  roomId: string;
  latitude: number;
  longitude: number;
  address?: string;
  sender?: string;
}
```

#### Audio Message
```typescript
export interface AudioMessageData {
  roomId: string;
  audioUrl: string;
  duration?: number;
  sender?: string;
}
```

### Nguyên tắc quan trọng

1. **Đồng bộ hóa**: Luôn emit cả sự kiện cụ thể (message:image) và sự kiện chung (message) để đảm bảo tất cả client đều nhận được.

2. **Validation**: Luôn kiểm tra dữ liệu đầu vào để tránh lỗi khi xử lý.

3. **Metadata**: Sử dụng field metadata để mở rộng thông tin mà không cần thay đổi cấu trúc cơ bản.

4. **Phân tách**: Mỗi loại tin nhắn nên có một controller riêng để dễ bảo trì.

5. **Documentation**: Cập nhật tài liệu API khi thêm loại tin nhắn mới.