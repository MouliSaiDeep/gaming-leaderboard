import { Router, Request, Response } from 'express';
import { redis } from '../redisClient.js';
import crypto from 'crypto';

const router = Router();


function formatLeaderboard(raw: string[]): { rank: number; user_id: string; score: number }[] {
  const leaderboard: { rank: number; user_id: string; score: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const userId = raw[i];
    const score = Number(raw[i + 1]);
    leaderboard.push({
      rank: (i / 2) + 1,
      user_id: userId,
      score: score
    });
  }
  return leaderboard;
}

// GET /api/leaderboard/global?limit=50
router.get('/global', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 50;
    const raw = await redis.zrevrange('leaderboard:global', 0, limit - 1, 'WITHSCORES');
    res.json(formatLeaderboard(raw));
  } catch (err) {
    console.error('Error fetching global leaderboard:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/leaderboard/country/{country_code}?limit=50
router.get('/country/:country_code', async (req: Request, res: Response): Promise<void> => {
  try {
    const countryCode = req.params.country_code.toUpperCase();
    const limit = Number(req.query.limit) || 50;
    const key = `leaderboard:country:${countryCode}`;
    const raw = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    res.json(formatLeaderboard(raw));
  } catch (err) {
    console.error('Error fetching country leaderboard:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/leaderboard/global/7-day?limit=50
router.get('/global/7-day', async (req: Request, res: Response): Promise<void> => {
  const limit = Number(req.query.limit) || 50;
  const tempKey = `temp:leaderboard:7day:${crypto.randomUUID()}`;

  // Compute 7 UTC daily keys ending today (inclusive)
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const yyyymmdd = d.toISOString().split('T')[0];
    dates.push(`leaderboard:daily:${yyyymmdd}`);
  }

  try {

    await redis.zunionstore(tempKey, dates.length, ...dates);

    const raw = await redis.zrevrange(tempKey, 0, limit - 1, 'WITHSCORES');
    res.json(formatLeaderboard(raw));
  } catch (err) {
    console.error('Error computing 7-day leaderboard:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {

    try {
      await redis.del(tempKey);
    } catch (delErr) {
      console.error(`Failed to delete temp key ${tempKey}:`, delErr);
    }
  }
});

export default router;
