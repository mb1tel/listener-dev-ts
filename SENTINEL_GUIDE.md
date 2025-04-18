# Hướng dẫn sử dụng Redis Sentinel

Redis Sentinel cung cấp khả năng high availability cho Redis bằng cách giám sát các instance Redis, thực hiện failover tự động và thông báo cho các ứng dụng client.

## 1. Cấu trúc Redis Sentinel

Thiết lập đã bao gồm:
- 1 Redis master
- 1 Redis replica (slave)
- 3 Redis Sentinel nodes

## 2. Chạy Redis Sentinel với Docker Compose

### Khởi động các containers

```bash
# Khởi động tất cả các service Redis Sentinel
docker-compose up -d redis-master redis-replica sentinel-1 sentinel-2 sentinel-3

# Kiểm tra trạng thái các containers
docker-compose ps
```

### Kiểm tra kết nối

Sử dụng script Python để kiểm tra kết nối:

```bash
# Cài đặt thư viện Python cần thiết
pip install redis

# Chạy script kiểm tra
python check_sentinel.py
```

## 3. Cấu hình Ứng dụng Socket.IO để sử dụng Redis Sentinel

Cấu hình cho ứng dụng Socket.IO có thể được thiết lập qua biến môi trường hoặc `.env`:

```
# Chế độ Redis
REDIS_MODE=sentinel

# Danh sách Sentinels
REDIS_SENTINELS=sentinel-1:26379,sentinel-2:26379,sentinel-3:26379

# Tên của master trong cấu hình Sentinel
REDIS_SENTINEL_NAME=mymaster

# Mật khẩu Sentinel (nếu được bảo mật)
REDIS_SENTINEL_PASSWORD=sentinel_password

# Mật khẩu Redis (nếu Redis master/replica được bảo mật)
REDIS_PASSWORD=bitnami
```

Để áp dụng ngay trong docker-compose.yml, mở comment các dòng cấu hình Sentinel:

```yaml
socketio:
  environment:
    # Cấu hình Sentinel
    - REDIS_MODE=sentinel
    - REDIS_SENTINELS=sentinel-1:26379,sentinel-2:26379,sentinel-3:26379
    - REDIS_SENTINEL_NAME=mymaster
    - REDIS_SENTINEL_PASSWORD=sentinel_password
    - REDIS_PASSWORD=bitnami
    # Comment các cấu hình Standalone
    # - REDIS_HOST=172.18.88.241
    # - REDIS_PORT=6379
```

## 4. Mô phỏng Failover

Để kiểm tra khả năng phục hồi lỗi, bạn có thể mô phỏng sự cố server bằng cách dừng Redis master:

```bash
# Dừng Redis master để kích hoạt failover
docker-compose stop redis-master

# Sau vài giây, kiểm tra lại trạng thái Sentinel
python check_sentinel.py
```

Redis Sentinel sẽ thăng cấp redis-replica thành master mới và ứng dụng Socket.IO sẽ tự động kết nối đến master mới.

## 5. Giám sát và quản trị

### Truy cập Redis CLI cho Sentinel

```bash
# Kết nối vào Sentinel
docker-compose exec sentinel-1 redis-cli -p 26379

# Nhập mật khẩu Sentinel (nếu đặt)
auth sentinel_password

# Kiểm tra trạng thái
sentinel masters
sentinel slaves mymaster
sentinel sentinels mymaster
```

### Lệnh Sentinel hữu ích

```
# Xem thông tin về master
SENTINEL masters

# Xem thông tin về các slave của master
SENTINEL slaves mymaster

# Xem thông tin về các sentinel khác
SENTINEL sentinels mymaster

# Xem lịch sử failover
SENTINEL failover-history mymaster
```

## 6. Khắc phục sự cố

### Vấn đề kết nối

Nếu ứng dụng Socket.IO không thể kết nối đến Redis thông qua Sentinel:

1. Kiểm tra các container Redis và Sentinel đang chạy
2. Kiểm tra log từ các container Sentinel
   ```bash
   docker-compose logs sentinel-1
   ```
3. Xác nhận các cấu hình mạng (network) trong Docker Compose
4. Xác minh mật khẩu Redis và Sentinel đã đúng

### Kiểm tra log Sentinel

```bash
# Xem log của Sentinel để tìm vấn đề
docker-compose logs --tail=50 sentinel-1 sentinel-2 sentinel-3
```

---

Tài liệu tham khảo:
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [Bitnami Redis Sentinel Docker Image](https://hub.docker.com/r/bitnami/redis-sentinel/) 