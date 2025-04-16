// redis-cluster.ts
import { Cluster } from 'ioredis';

const redisCluster = new Cluster(
  [
    { host: '172.18.88.242', port: 6379 },
    { host: '172.18.88.243', port: 6379 },
    { host: '172.18.88.244', port: 6379 },
    { host: '172.18.88.245', port: 6379 },
    { host: '172.18.88.246', port: 6379 },
    { host: '172.18.88.247', port: 6379 },
  ],
  {
    redisOptions: {
      // Optional configs
      password: 'AAmMVw9Um4',
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
    },
    scaleReads: 'slave', // optional: 'master' | 'slave' | 'all'
    slotsRefreshTimeout: 2000,
    slotsRefreshInterval: 5000,
  }
);

redisCluster.on('connect', () => {
  console.log('✅ Redis Cluster connected');
});

redisCluster.on('error', (err) => {
  console.error('❌ Redis Cluster error:', err);
});

async function run() {
  // Set value
  await redisCluster.set('clients:abc123', 'hello cluster');

  // Get value
  const value = await redisCluster.get('clients:abc123');
  console.log('Value:', value);

  // Add instanceId to a set
  await redisCluster.sadd('active_instances', 'instance:abc123');

  // Get all active instances
  const instances = await redisCluster.smembers('active_instances');
  console.log('Active instances:', instances);
}

run().catch(console.error);
