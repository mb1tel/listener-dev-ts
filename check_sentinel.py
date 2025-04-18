#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script kiểm tra kết nối Redis Sentinel
"""

import redis
from redis.sentinel import Sentinel
import time
import sys

def check_master_status(sentinel_hosts):
    """Kiểm tra trạng thái master thông qua Sentinel"""
    try:
        # Kết nối đến tất cả các Sentinel nodes
        sentinel = Sentinel(sentinel_hosts, socket_timeout=1.0, password="sentinel_password")
        
        # Lấy thông tin về master node
        master_host, master_port = sentinel.discover_master('mymaster')
        print(f"✅ Tìm thấy Redis master tại: {master_host}:{master_port}")
        
        # Kết nối đến master
        master = sentinel.master_for(
            'mymaster', 
            socket_timeout=0.5,
            password="bitnami"
        )
        
        # Kiểm tra xem có thể đọc/ghi vào master
        master.set('sentinel_test_key', 'Kết nối thành công đến Redis thông qua Sentinel!')
        value = master.get('sentinel_test_key')
        print(f"✅ Đọc/ghi thành công: {value.decode('utf-8')}")
        
        # Liệt kê các slave nodes
        slaves = sentinel.discover_slaves('mymaster')
        print(f"✅ Đã tìm thấy {len(slaves)} Redis slave nodes:")
        for i, slave in enumerate(slaves, 1):
            print(f"  {i}. {slave[0]}:{slave[1]}")
            
        return True
    except Exception as e:
        print(f"❌ Lỗi khi kết nối Redis Sentinel: {str(e)}")
        return False

def get_sentinel_info(sentinel_hosts):
    """Lấy thông tin chi tiết từ các Sentinels"""
    for host, port in sentinel_hosts:
        try:
            print(f"\n--- Thông tin từ Sentinel {host}:{port} ---")
            redis_client = redis.Redis(host=host, port=port, password="sentinel_password")
            
            # Lấy thông tin về Sentinel
            info = redis_client.execute_command("INFO", "Sentinel")
            print(f"Sentinel info: {info.decode('utf-8')}")
            
            # Lấy thông tin về master
            masters = redis_client.execute_command("SENTINEL", "masters")
            print(f"Masters: {masters}")
            
            # Lấy thông tin về slaves
            slaves = redis_client.execute_command("SENTINEL", "slaves", "mymaster")
            print(f"Slaves: {slaves}")
            
        except Exception as e:
            print(f"❌ Không thể kết nối đến Sentinel {host}:{port}: {str(e)}")

if __name__ == "__main__":
    # Danh sách các sentinel hosts
    sentinel_hosts = [
        ('sentinel-1', 26379),
        ('sentinel-2', 26379),
        ('sentinel-3', 26379)
    ]
    
    print("Kiểm tra kết nối Redis Sentinel...\n")
    
    # Thử kiểm tra lặp lại vài lần nếu khởi động lần đầu
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        print(f"Lần thử {attempt}/{max_attempts}...")
        if check_master_status(sentinel_hosts):
            get_sentinel_info(sentinel_hosts)
            print("\n✅ Kiểm tra Redis Sentinel thành công!")
            sys.exit(0)
        else:
            if attempt < max_attempts:
                print(f"Đợi 5 giây và thử lại...")
                time.sleep(5)
    
    print("\n❌ Không thể kết nối với Redis Sentinel sau nhiều lần thử!")
    sys.exit(1) 