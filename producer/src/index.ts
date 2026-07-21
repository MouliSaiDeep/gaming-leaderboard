import Redis from 'ioredis';
import { faker } from '@faker-js/faker';
import express from 'express';
import { setHealthy, healthHandler } from './health.js';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const PRODUCER_INTERVAL_MS = Number(process.env.PRODUCER_INTERVAL_MS) || 200;
const PORT = Number(process.env.PORT) || 8001;

const app = express();
app.get('/health', healthHandler);

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null
});


const COUNTRIES = ['US', 'DE', 'JP', 'FR', 'BR', 'IN', 'GB', 'CA', 'AU', 'MX'];


const USER_POOL_SIZE = 500;
const userPool: { id: string; country: string }[] = [];


for (let i = 0; i < USER_POOL_SIZE; i++) {
  userPool.push({
    id: faker.string.alphanumeric(8).toUpperCase(),
    country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
  });
}

function getSkewedScore(): number {
  const rand = Math.random();
  if (rand < 0.90) {
    return Math.floor(Math.random() * 20) + 1;
  } else {
    return Math.floor(Math.random() * 180) + 21;
  }
}

let intervalId: NodeJS.Timeout | null = null;

redis.on('connect', () => {
  console.log('Producer connected to Redis');
  setHealthy(true);

  if (!intervalId) {
    intervalId = setInterval(async () => {
      try {

        let user: { id: string; country: string };
        if (Math.random() < 0.95) {
          user = userPool[Math.floor(Math.random() * userPool.length)];
        } else {
          user = {
            id: faker.string.alphanumeric(8).toUpperCase(),
            country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
          };
          userPool[Math.floor(Math.random() * userPool.length)] = user;
        }

        const score = getSkewedScore();
        const timestamp = new Date().toISOString();

        // Publishes via XADD score_events * user_id <id> country_code <cc> score <n> timestamp <iso8601>
        await redis.xadd(
          'score_events',
          '*',
          'user_id',
          user.id,
          'country_code',
          user.country,
          'score',
          score.toString(),
          'timestamp',
          timestamp
        );
      } catch (err) {
        console.error('Error generating or writing event:', err);
      }
    }, PRODUCER_INTERVAL_MS);
  }
});

redis.on('error', (err) => {
  console.error('Redis error in Producer:', err);
  setHealthy(false);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Producer healthcheck server listening on port ${PORT}`);
});
