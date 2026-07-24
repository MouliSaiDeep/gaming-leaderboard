export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  score: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchGlobalLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/api/leaderboard/global?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch global leaderboard');
  return res.json();
}

export async function fetchCountryLeaderboard(countryCode: string, limit = 50): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/api/leaderboard/country/${countryCode.toUpperCase()}?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch leaderboard for country ${countryCode}`);
  return res.json();
}

export async function fetch7DayLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/api/leaderboard/global/7-day?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch 7-day leaderboard');
  return res.json();
}
