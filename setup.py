import os
import json
import subprocess
import sys

def create_directory(path):
    if not os.path.exists(path):
        os.makedirs(path)
        print(f"Created directory: {path}")
    else:
        print(f"Directory already exists: {path}")

def create_file(path, content=""):
    with open(path, "w") as f:
        f.write(content)
    print(f"Created file: {path}")

def setup_project():
    # 1. Setup main project directory
    main_dir = "socketio"
    create_directory(main_dir)
    
    # 2. Create package.json
    package_json = {
        "name": "socketio",
        "version": "1.0.0",
        "description": "Socket.IO Multiple Instances Project",
        "main": "dist/server.js",
        "scripts": {
            "start": "node dist/server.js",
            "dev": "nodemon --exec ts-node src/server.ts",
            "build": "tsc",
            "test": "echo \"Error: no test specified\" && exit 1"
        },
        "keywords": ["socket.io", "redis", "cluster"],
        "author": "",
        "license": "ISC",
        "dependencies": {
            "socket.io": "^4.6.1",
            "express": "^4.18.2",
            "dotenv": "^16.0.3",
            "winston": "^3.8.2",
            "ioredis": "^5.3.2",
            "@socket.io/redis-adapter": "^8.1.0"
        },
        "devDependencies": {
            "nodemon": "^2.0.22",
            "typescript": "^5.0.4",
            "@types/node": "^18.16.0",
            "@types/express": "^4.17.17",
            "ts-node": "^10.9.1"
        }
    }
    
    create_file(os.path.join(main_dir, "package.json"), json.dumps(package_json, indent=2))
    
    # 3. Create tsconfig.json
    tsconfig_json = {
        "compilerOptions": {
            "target": "ES2020",
            "module": "CommonJS",
            "outDir": "./dist",
            "rootDir": "./src",
            "strict": True,
            "esModuleInterop": True,
            "forceConsistentCasingInFileNames": True,
            "resolveJsonModule": True,
            "skipLibCheck": True
        },
        "include": ["src/**/*"],
        "exclude": ["node_modules"]
    }
    
    create_file(os.path.join(main_dir, "tsconfig.json"), json.dumps(tsconfig_json, indent=2))
    
    # 4. Create project structure
    src_dir = os.path.join(main_dir, "src")
    create_directory(src_dir)
    
    # Create subdirectories
    directories = [
        os.path.join(src_dir, "config"),
        os.path.join(src_dir, "models"),
        os.path.join(src_dir, "services"),
        os.path.join(src_dir, "utils"),
        os.path.join(src_dir, "controllers"),
        os.path.join(src_dir, "middleware"),
        os.path.join(src_dir, "types")
    ]
    
    for directory in directories:
        create_directory(directory)
    
    # 5. Create simulation folders
    simulation_dirs = ["nginx", "public", "webhook", "redis"]
    for sim_dir in simulation_dirs:
        create_directory(sim_dir)
    
    # 6. Create basic server.ts file
    server_ts = """import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Basic route
app.get('/', (req, res) => {
  res.send('Socket.IO Server is running');
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Client ${socket.id} joined room: ${roomId}`);
  });
  
  // Handle messages
  socket.on('message', (data) => {
    console.log(`Message received in room ${data.roomId}: ${data.message}`);
    io.to(data.roomId).emit('message', {
      id: Date.now(),
      text: data.message,
      sender: data.sender || 'Anonymous',
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
"""
    create_file(os.path.join(src_dir, "server.ts"), server_ts)
    
    # 7. Create .env file
    env_content = """PORT=3000
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
"""
    create_file(os.path.join(main_dir, ".env"), env_content)
    
    # 8. Create a basic HTML client for testing
    test_client_html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Socket.IO Test Client</title>
  <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    #messages { height: 300px; border: 1px solid #ccc; overflow-y: auto; margin-bottom: 20px; padding: 10px; }
    .message { margin-bottom: 10px; padding: 5px; }
    .message .sender { font-weight: bold; }
    .message .time { font-size: 0.8em; color: #666; }
    input, button { padding: 8px; margin-right: 5px; }
    #message-form { display: flex; }
    #message-input { flex-grow: 1; }
  </style>
</head>
<body>
  <h1>Socket.IO Test Client</h1>
  
  <div>
    <label for="room-input">Room ID:</label>
    <input type="text" id="room-input" placeholder="Enter room ID">
    <button id="join-btn">Join Room</button>
  </div>
  
  <div id="messages"></div>
  
  <form id="message-form">
    <input type="text" id="message-input" placeholder="Type a message..." disabled>
    <button type="submit" id="send-btn" disabled>Send</button>
  </form>
  
  <script>
    const messagesDiv = document.getElementById('messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const roomInput = document.getElementById('room-input');
    const joinBtn = document.getElementById('join-btn');
    
    let currentRoom = null;
    // Connect to the Socket.IO server
    const socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
      addSystemMessage(`Connected to server with ID: ${socket.id}`);
    });
    
    socket.on('disconnect', () => {
      addSystemMessage('Disconnected from server');
      messageInput.disabled = true;
      sendBtn.disabled = true;
    });
    
    socket.on('message', (data) => {
      addMessage(data);
    });
    
    joinBtn.addEventListener('click', () => {
      const roomId = roomInput.value.trim();
      if (!roomId) {
        alert('Please enter a room ID');
        return;
      }
      
      // Join the room
      socket.emit('join-room', roomId);
      currentRoom = roomId;
      addSystemMessage(`Joined room: ${roomId}`);
      
      // Enable messaging
      messageInput.disabled = false;
      sendBtn.disabled = false;
    });
    
    messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = messageInput.value.trim();
      if (!message || !currentRoom) return;
      
      // Send message to server
      socket.emit('message', {
        roomId: currentRoom,
        message,
        sender: `User-${socket.id.substring(0, 5)}`
      });
      
      // Clear input
      messageInput.value = '';
    });
    
    function addMessage(data) {
      const messageEl = document.createElement('div');
      messageEl.className = 'message';
      messageEl.innerHTML = `
        <span class="sender">${data.sender}:</span>
        <span class="text">${data.text}</span>
        <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>
      `;
      messagesDiv.appendChild(messageEl);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    function addSystemMessage(text) {
      const messageEl = document.createElement('div');
      messageEl.className = 'message system';
      messageEl.innerHTML = `
        <span class="sender">System:</span>
        <span class="text">${text}</span>
        <span class="time">${new Date().toLocaleTimeString()}</span>
      `;
      messagesDiv.appendChild(messageEl);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  </script>
</body>
</html>
"""
    create_file(os.path.join("public", "index.html"), test_client_html)
    
    print("\nProject setup completed successfully!")
    print("\nTo complete setup, navigate to the socketio directory and run:")
    print("npm install")
    print("npm run dev")

if __name__ == "__main__":
    setup_project() 