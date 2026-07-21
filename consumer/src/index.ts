import Redis from 'ioredis';
import express from 'express';
import { setHealthy, healthHandler } from './health.js';
import { loadLuaScript, executeLeaderboardScript } from './luaScripts.js';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const PORT = Number(process.env.PORT) || 8002;

const app = express();
app.get('/health', healthHandler);

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null
});

const STREAM_NAME = 'score_events';
const GROUP_NAME = 'leaderboard_group';
const CONSUMER_NAME = 'consumer_node';

let isRunning = false;

async function setupConsumerGroup() {
  try {

    await redis.xgroup('CREATE', STREAM_NAME, GROUP_NAME, '$', 'MKSTREAM');
    console.log(`Consumer group '${GROUP_NAME}' created successfully.`);
  } catch (err: any) {
    if (err.message && err.message.includes('BUSYGROUP')) {
      console.log(`Consumer group '${GROUP_NAME}' already exists.`);
    } else {
      throw err;
    }
  }
}

async function startConsumerLoop() {
  isRunning = true;
  console.log('Starting consumer loop...');

  while (isRunning) {
    try {

      const results = await redis.xreadgroup(
        'GROUP',
        GROUP_NAME,
        CONSUMER_NAME,
        'COUNT',
        '10',
        'BLOCK',
        '2000',
        'STREAMS',
        STREAM_NAME,
        '>'
      ) as any;

      if (!results) {
        continue;
      }

      for (const [streamName, messages] of results) {
        for (const [messageId, fields] of messages) {

          const messageMap: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            messageMap[fields[i]] = fields[i + 1];
          }

          try {
            const { user_id, country_code, score, timestamp } = messageMap;


            if (!user_id || !country_code || !score || !timestamp) {
              console.warn(`[Malformed Stream Message] Missing fields in message ${messageId}:`, messageMap);
              await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
              continue;
            }

            const parsedScore = Number(score);
            if (isNaN(parsedScore)) {
              console.warn(`[Malformed Stream Message] Score is not a number in message ${messageId}:`, messageMap);
              await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
              continue;
            }

            const parsedDate = new Date(timestamp);
            if (isNaN(parsedDate.getTime())) {
              console.warn(`[Malformed Stream Message] Invalid timestamp in message ${messageId}:`, messageMap);
              await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
              continue;
            }


            const yyyymmdd = parsedDate.toISOString().split('T')[0];

            const globalKey = 'leaderboard:global';
            const countryKey = `leaderboard:country:${country_code.toUpperCase()}`;
            const dailyKey = `leaderboard:daily:${yyyymmdd}`;


            await executeLeaderboardScript(
              redis,
              [globalKey, countryKey, dailyKey],
              [user_id, parsedScore]
            );


            await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
          } catch (msgErr) {
            console.error(`Error processing message ${messageId}:`, msgErr);

            try {
              await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
            } catch (ackErr) {
              console.error(`Failed to acknowledge failed message ${messageId}:`, ackErr);
            }
          }
        }
      }
    } catch (loopErr) {
      console.error('Error in consumer read loop:', loopErr);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

redis.on('connect', async () => {
  console.log('Consumer connected to Redis');
  try {
    await loadLuaScript(redis);
    await setupConsumerGroup();
    setHealthy(true);

    if (!isRunning) {
      startConsumerLoop().catch((err) => {
        console.error('Fatal error in consumer loop:', err);
        setHealthy(false);
      });
    }
  } catch (err) {
    console.error('Error during consumer startup initialization:', err);
    setHealthy(false);
  }
});

redis.on('error', (err) => {
  console.error('Redis error in Consumer:', err);
  setHealthy(false);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Consumer healthcheck server listening on port ${PORT}`);
});
