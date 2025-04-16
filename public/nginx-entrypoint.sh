#!/bin/sh
set -e

# Get the Socket.IO server URL from environment variable or default
# Use window.location.hostname để client tự động sử dụng hostname hiện tại thay vì hardcode
SOCKETIO_SERVER=${SOCKETIO_SERVER:-"http://nginx:80"}

echo "Configuring web client with Socket.IO server: $SOCKETIO_SERVER"

# Create a new config.js with the Socket.IO server URL
cat > /usr/share/nginx/html/config.js << EOF
// Configuration for Socket.IO Web Demo Client
window.CONFIG = {
  // Socket.IO server URL from Docker environment - dynamically use window.location.hostname
  // null để force sử dụng client-side detection
  SOCKETIO_SERVER: '$SOCKETIO_SERVER',
  
  // Authentication secret key
  SECRET_KEY: 'your_super_secret_socket_key_2024',
  
  // Default room for joining
  DEFAULT_ROOM: 'demo',
  
  // UI Configuration
  UI: {
    THEME: 'light',
    AUTO_SCROLL: true,
    NOTIFICATION_SOUND: true,
    MESSAGE_HISTORY_LIMIT: 100
  },
  
  // Debug options
  DEBUG: {
    ENABLE_LOGS: true,
    SHOW_CONNECTION_DETAILS: true
  }
};
EOF

# Set correct file permissions
chmod 644 /usr/share/nginx/html/config.js

echo "Configuration completed, starting Nginx..."

# Start Nginx
exec nginx -g 'daemon off;' 