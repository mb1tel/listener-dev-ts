const express = require('express');
const { io } = require('socket.io-client');
const bodyParser = require('body-parser');

// Create Express server
const app = express();
const PORT = process.env.PORT || 4000;

// Socket.IO server configuration
// const SOCKETIO_URL = process.env.SOCKETIO_URL || 'http://localhost:3000';
// const SECRET_KEY = process.env.SECRET_KEY || 'your_super_secret_socket_key_2024';
const SOCKETIO_URL = 'https://listener-dev.matbao.one';
const SECRET_KEY = 'UZ0v0793XHRw3g04muU7N4XQHwMRR45';
const SOCKET_NAME = process.env.SOCKET_NAME || 'hooks-api';

console.log(`Connecting to Socket.IO server at ${SOCKETIO_URL}`);

// Lưu trữ socket để tái sử dụng và kiểm tra trạng thái
let socket;

// Hàm tạo kết nối socket với cấu hình reconnect
function createSocketConnection() {
  // Connect to Socket.IO server with authentication and reconnection options
  socket = io(SOCKETIO_URL, {
    path: '/listener',
    transports: ['websocket'],
    auth: {
      secret: SECRET_KEY
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    query: {
      socket_name: SOCKET_NAME
    }
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Connected to Socket.IO server as webhook client');
  });

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected from Socket.IO server. Reason: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  // Reconnection events
  socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected to Socket.IO server after ${attemptNumber} attempts`);
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Attempting to reconnect to Socket.IO server: attempt ${attemptNumber}`);
  });

  socket.on('reconnect_error', (error) => {
    console.error('Reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('Failed to reconnect to Socket.IO server after all attempts');
    // Thử kết nối lại sau 10 giây nếu toàn bộ quá trình reconnect thất bại
    setTimeout(createSocketConnection, 10000);
  });

  return socket;
}

// Khởi tạo kết nối ban đầu
socket = createSocketConnection();

// Kiểm tra định kỳ kết nối và thử kết nối lại nếu cần
setInterval(() => {
  if (!socket.connected) {
    console.log('Socket connection is broken, attempting manual reconnection...');
    socket.close(); // Đóng socket hiện tại
    socket = createSocketConnection(); // Tạo kết nối mới
  }
}, 30000);

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.send('Webhook Server is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    socketConnected: socket ? socket.connected : false
  });
});

// Webhook endpoint to forward messages to Socket.IO server
app.post('/webhook', (req, res) => {
  try {
    const { roomId, message, sender } = req.body;
    
    if (!roomId || !message) {
      return res.status(400).json({ error: 'roomId and message are required' });
    }
    
    console.log(`Webhook received: Room=${roomId}, Message=${message}, Sender=${sender || 'System'}`);
    
    // Kiểm tra kết nối trước khi gửi tin nhắn
    if (!socket || !socket.connected) {
      console.log('Socket not connected, attempting to reconnect before sending message');
      
      // Thử kết nối lại nếu chưa kết nối
      if (!socket) {
        socket = createSocketConnection();
      } else {
        socket.connect();
      }
      
      // Trả về phản hồi nhưng thông báo rằng tin nhắn đang chờ xử lý
      return res.status(202).json({ 
        status: 'pending', 
        message: 'Socket reconnecting, message will be delivered when connection is established' 
      });
    }
    
    // Emit message to Socket.IO server
    socket.emit('message', {
      roomId,
      message,
      sender: sender || 'Webhook System'
    });
    
    res.status(200).json({ status: 'ok', message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/webhook/zalo', (req, res) => {
  try {
    const { roomId, exceptId, message, sender } = req.body;
    
    if (!roomId || !message) {
      return res.status(400).json({ error: 'roomId and message are required' });
    }
    
    console.log(`Webhook Zalo received: Room=${roomId}, Message=${message}, Sender=${sender || 'System'}`);
    
    // Kiểm tra kết nối trước khi gửi tin nhắn
    if (!socket || !socket.connected) {
      console.log('Socket not connected, attempting to reconnect before sending message');
      
      // Thử kết nối lại nếu chưa kết nối
      if (!socket) {
        socket = createSocketConnection();
      } else {
        socket.connect();
      }
      
      // Trả về phản hồi nhưng thông báo rằng tin nhắn đang chờ xử lý
      return res.status(202).json({ 
        status: 'pending', 
        message: 'Socket reconnecting, message will be delivered when connection is established' 
      });
    }
    
    // Emit message to Socket.IO server
    socket.emit('message:zalo', {
      roomId,
      exceptId,
      message,
      sender: sender || 'Webhook System'
    });
    
    res.status(200).json({ status: 'ok', message: 'Webhook Zalo processed successfully' });
  } catch (error) {
    console.error('Error processing webhook Zalo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xử lý khi server đóng
process.on('SIGINT', () => {
  socket.disconnect();
  process.exit();
});

// Start the webhook server
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
}); 