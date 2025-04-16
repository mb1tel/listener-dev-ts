import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Parse Redis nodes for cluster mode
const parseRedisNodes = () => {
  const nodes = process.env.REDIS_NODES;
  if (!nodes) return [];
  
  return nodes.split(',').map(node => {
    const [host, port] = node.split(':');
    return { host, port: parseInt(port, 10) };
  });
};

// Environment variables with default values
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  REDIS: {
    MODE: process.env.REDIS_MODE || 'standalone', // 'standalone' or 'cluster'
    HOST: process.env.REDIS_HOST || 'localhost',
    PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    USERNAME: process.env.REDIS_USERNAME || '',
    PASSWORD: process.env.REDIS_PASSWORD || '',
    NODES: parseRedisNodes(),
  },
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  SECRET_KEY: process.env.SECRET_KEY || 'socket_default_secret_key',
};

// Validate required environment variables
export const validateEnv = () => {
  const requiredVars: string[] = ['SECRET_KEY'];
  
  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      throw new Error(`Environment variable ${envVar} is required but not set.`);
    }
  }
  
  // Verify Redis configuration
  if (env.REDIS.MODE === 'cluster' && env.REDIS.NODES.length === 0) {
    throw new Error('Redis cluster mode requires REDIS_NODES to be set');
  }
}; 