import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { env } from '../config/env';
import logger from '../utils/logger';

/**
 * Middleware to authenticate Socket.IO connections using a secret key
 * The key should be provided in the auth object when connecting
 */
export const socketAuthMiddleware = (
  socket: Socket,
  next: (err?: ExtendedError) => void
) => {
  const { auth } = socket.handshake;
  
  // Check if auth data exists
  if (!auth) {
    logger.warn(`Authentication failed: No auth data provided. Client: ${socket.id}`);
    return next(new Error('Authentication error: No auth data provided'));
  }
  
  // Check if secret key is correct
  if (auth.secret !== env.SECRET_KEY) {
    logger.warn(`Authentication failed: Invalid secret key. Client: ${socket.id}`);
    return next(new Error('Authentication error: Invalid authentication credentials'));
  }
  
  logger.info(`Client authenticated successfully: ${socket.id}`);
  next();
}; 