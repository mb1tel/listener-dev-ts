# Socket.IO Server

Socket.IO Server là dự án Node.js sử dụng Socket.IO để cung cấp khả năng real-time communication, được thiết kế để hoạt động trên nhiều instances thông qua Redis Adapter.

## Cấu trúc dự án

```
/socketio
  ├── src/                 # Mã nguồn
  │   ├── config/          # Cấu hình
  │   ├── controllers/     # Controllers xử lý message
  │   ├── middleware/      # Middleware xác thực
  │   ├── models/          # Định nghĩa model
  │   ├── services/        # Business logic
  │   ├── types/           # Định nghĩa TypeScript
  │   └── utils/           # Tiện ích chung
  ├── Dockerfile           # Cấu hình Docker
  └── package.json         # Cấu hình project
```

## Phát triển

### Yêu cầu

- Node.js >= 14
- npm >= 6
- Redis (local hoặc container)

### Cài đặt

```bash
cd socketio
npm install
```

### Chạy môi trường phát triển

```bash
npm run dev
```

### Build

```bash
npm run build
npm start
```

### Biến môi trường

| Biến | Mô tả | Mặc định |
|------|-------|----------|
| PORT | Port cho server | 3000 |
| REDIS_MODE | Chế độ kết nối Redis (standalone/cluster/sentinel) | standalone |
| REDIS_HOST | Hostname của Redis (cho standalone mode) | localhost |
| REDIS_PORT | Port của Redis (cho standalone mode) | 6379 |
| REDIS_USERNAME | Username của Redis | |
| REDIS_PASSWORD | Password của Redis | |
| REDIS_NODES | Danh sách các nodes cho cluster mode (host1:port1,host2:port2) | |
| REDIS_SENTINELS | Danh sách các sentinels (host1:port1,host2:port2) | |
| REDIS_SENTINEL_NAME | Tên của master trong Redis Sentinel | mymaster |
| REDIS_SENTINEL_PASSWORD | Password cho Redis Sentinel | |
| INSTANCE_ID | ID của instance | random |
| SECRET_KEY | Key bảo mật | |

### Redis Mode

Dự án hỗ trợ ba chế độ kết nối Redis khác nhau:

#### 1. Standalone Mode
Kết nối đến một instance Redis đơn lẻ.
```
REDIS_MODE=standalone
REDIS_HOST=redis
REDIS_PORT=6379
```

#### 2. Cluster Mode
Kết nối đến Redis Cluster với nhiều nodes.
```
REDIS_MODE=cluster
REDIS_NODES=redis-node-0:6379,redis-node-1:6379,redis-node-2:6379
```

#### 3. Sentinel Mode
Kết nối thông qua Redis Sentinel để đảm bảo high availability.
```
REDIS_MODE=sentinel
REDIS_SENTINELS=sentinel-0:26379,sentinel-1:26379,sentinel-2:26379
REDIS_SENTINEL_NAME=mymaster
```

### Cấu hình môi trường

Dự án hỗ trợ việc tùy chỉnh môi trường thông qua file `.env`. Một file mẫu `.env.sample` đã được cung cấp.

Để cấu hình:

1. Sao chép file mẫu: `cp .env.sample .env`
2. Chỉnh sửa các giá trị trong file `.env` theo nhu cầu

Khi chạy với Docker:
- Trong môi trường development: Sẽ sử dụng file `.env` được mount vào container
- Trong môi trường production: Sẽ sử dụng các biến môi trường được định nghĩa trong `docker-compose.yml` hoặc K8s manifest

### Chạy trong Docker

Để xây dựng image cho development:
```bash
docker build -t socketio-server --build-arg NODE_ENV=development .
```

Để xây dựng image cho production:
```bash
docker build -t socketio-server --build-arg NODE_ENV=production .
```

Để chạy container với file .env:
```bash
docker run -p 3000:3000 -v $(pwd)/.env:/env/.env socketio-server
```

## Triển khai với Kubernetes và GitHub Actions

Dự án đã được cấu hình để tự động triển khai lên Kubernetes thông qua GitHub Actions. Quy trình CI/CD bao gồm:

1. Build Docker image từ mã nguồn
2. Đẩy lên GitHub Container Registry (ghcr.io)
3. Triển khai lên Kubernetes cluster

### Yêu cầu

- Kubernetes cluster
- GitHub repository
- GitHub Secret: `KUBE_CONFIG`

### GitHub Actions Workflow

File `.github/workflows/deploy.yml` định nghĩa quy trình CI/CD. Quy trình này sẽ tự động chạy khi có push lên nhánh `main` với thay đổi trong thư mục `socketio` hoặc `k8s`.

Bạn cũng có thể chạy thủ công thông qua GitHub Actions UI.

### Kubernetes Manifests

Xem thư mục [`k8s/`](../k8s/) để biết thêm chi tiết về các manifest files và hướng dẫn triển khai.

## Tính năng chính

- WebSocket real-time communication
- Khả năng mở rộng với nhiều instances
- Redis Adapter cho đồng bộ giữa các instances
- Hỗ trợ các loại tin nhắn khác nhau thông qua MessageController
- Quản lý phòng chat linh hoạt
- Webhook API cho tích hợp với các hệ thống bên ngoài

## Mở rộng

Xem hướng dẫn trong [README.md](../README.md) chính của dự án để biết cách thêm các loại tin nhắn mới. 