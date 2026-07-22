import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { redis, pubsubClient } from './redisClient.js';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });


  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname === '/ws/rank-updates') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch (err) {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected to /ws/rank-updates');
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });


  pubsubClient.subscribe('rank_updates', (err, count) => {
    if (err) {
      console.error('Failed to subscribe to rank_updates channel:', err);
    } else {
      console.log(`Subscribed to Redis channel 'rank_updates'. Active subscriptions: ${count}`);
    }
  });

  pubsubClient.on('message', async (channel, message) => {
    if (channel !== 'rank_updates') return;

    try {
      const payload = JSON.parse(message);
      
      // ZREVRANK is already 0-indexed descending (0 = highest score). Convert to 1-indexed.
      const oldRank1Indexed = payload.old_rank + 1;
      const newRank1Indexed = payload.new_rank + 1;

      const wsPayload = {
        event: 'RANK_UPDATE',
        data: {
          user_id: payload.user_id,
          old_rank: oldRank1Indexed,
          new_rank: newRank1Indexed,
          score: payload.score
        }
      };

      const broadcastMsg = JSON.stringify(wsPayload);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastMsg);
        }
      });
    } catch (err) {
      console.error('Error processing rank update message for WebSocket clients:', err);
    }
  });
}
