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
| REDIS_HOST | Hostname của Redis | localhost |
| REDIS_PORT | Port của Redis | 6379 |
| REDIS_PASSWORD | Password của Redis | |
| INSTANCE_ID | ID của instance | random |
| SECRET_KEY | Key bảo mật | |

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