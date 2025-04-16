// Socket.IO Multi-Instance Configuration
window.CONFIG = {
  // Socket.IO server connection settings
  // Setting to null will use auto-detection based on current window location
  // Trong Docker: http://nginx:80
  // Trong browser: sẽ được tự động chuyển đổi thành localhost trong index.html
  SOCKETIO_SERVER: 'http://nginx:80',
  
  // Authentication secret key
  SECRET_KEY: 'your_super_secret_socket_key_2024',
  
  // Default room to join on page load
  DEFAULT_ROOM: 'room1',
  
  // UI settings
  UI: {
    // Auto-scroll messages pane when new messages arrive
    AUTO_SCROLL: true,
    
    // Maximum number of messages to keep in history
    MESSAGE_HISTORY_LIMIT: 100,
    
    // Refresh interval for health checks (ms)
    HEALTH_CHECK_INTERVAL: 30000
  },
  
  // Debug settings
  DEBUG: {
    // Enable console logging
    ENABLE_LOGS: true,
    
    // Log connection events
    LOG_CONNECTION: true,
    
    // Log messages
    LOG_MESSAGES: false
  }
}; 