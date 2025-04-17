import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { env, validateEnv } from './config/env';
import logger from './utils/logger';
import { SocketService } from './services/socketService';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Validate environment variables
validateEnv();

// Get instance ID for logging
const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || `dev-${Date.now()}`;

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO service
const socketService = new SocketService(server);

// Middleware
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../public')));

// Basic routes
app.get('/', (req: Request, res: Response) => {
  res.send(`Listener Server is running (Instance ID: ${instanceId})`);
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok',
    instanceId,
    timestamp: new Date().toISOString() 
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start the server
server.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode (Instance ID: ${instanceId})`);
});
