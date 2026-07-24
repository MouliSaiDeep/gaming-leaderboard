import { useEffect, useRef, useState } from 'react';

export interface RankUpdateMessage {
  event: 'RANK_UPDATE';
  data: {
    user_id: string;
    old_rank: number;
    new_rank: number;
    score: number;
  };
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export function useWebSocket(onRankUpdate: (data: RankUpdateMessage['data']) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      console.log('Connecting to WebSocket...');
      const ws = new WebSocket(`${WS_URL}/ws/rank-updates`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as RankUpdateMessage;
          if (payload.event === 'RANK_UPDATE') {
            onRankUpdate(payload.data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed, retrying in 3s...');
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        // Remove close listener to prevent reconnect trigger during cleanup
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [onRankUpdate]);

  return isConnected;
}
