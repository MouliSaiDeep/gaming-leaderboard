import express from 'express';
import cors from 'cors';
import http from 'http';
import leaderboardRouter from './routes/leaderboard.js';
import { setupWebSocket } from './websocket.js';
import { redis } from './redisClient.js';

const PORT = Number(process.env.PORT) || 8000;

const app = express();
app.use(cors());
app.use(express.json());


app.use('/api/leaderboard', leaderboardRouter);


app.get('/health', (req, res) => {

  const isRedisConnected = redis.status === 'ready';

  if (isRedisConnected) {
    res.status(200).json({ status: 'OK', redis: 'connected' });
  } else {
    res.status(503).json({ status: 'Service Unavailable', redis: redis.status });
  }
});

const server = http.createServer(app);


setupWebSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`API and WebSocket server listening on port ${PORT}`);
});
