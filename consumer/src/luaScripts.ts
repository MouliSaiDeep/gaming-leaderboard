import { Redis } from 'ioredis';

export const LUA_SCRIPT = `-- KEYS[1] = global leaderboard key
-- KEYS[2] = country leaderboard key
-- KEYS[3] = daily leaderboard key
-- ARGV[1] = user_id
-- ARGV[2] = score increment (number)

local old_rank = redis.call('ZREVRANK', KEYS[1], ARGV[1])

redis.call('ZINCRBY', KEYS[1], ARGV[2], ARGV[1])
redis.call('ZINCRBY', KEYS[2], ARGV[2], ARGV[1])
redis.call('ZINCRBY', KEYS[3], ARGV[2], ARGV[1])

local new_rank = redis.call('ZREVRANK', KEYS[1], ARGV[1])
local new_score = redis.call('ZSCORE', KEYS[1], ARGV[1])

if old_rank and new_rank and old_rank ~= new_rank and old_rank < 100 and new_rank < 100 then
    local payload = cjson.encode({
        user_id = ARGV[1],
        old_rank = old_rank,
        new_rank = new_rank,
        score = tonumber(new_score)
    })
    redis.call('PUBLISH', 'rank_updates', payload)
end

return new_rank`;

let scriptSha: string | null = null;

/**
 * Loads the Lua script into Redis and caches the returned SHA hash.
 */
export async function loadLuaScript(redis: Redis): Promise<string> {
  const result = await redis.script('LOAD', LUA_SCRIPT);
  if (typeof result !== 'string') {
    throw new Error('Failed to load Lua script into Redis');
  }
  scriptSha = result;
  return scriptSha;
}

/**
 * Executes the leaderboard Lua script, utilizing EVALSHA if available,
 * and falling back to EVAL on NOSCRIPT errors.
 */
export async function executeLeaderboardScript(
  redis: Redis,
  keys: string[],
  args: (string | number)[]
): Promise<number | null> {
  if (!scriptSha) {
    await loadLuaScript(redis);
  }

  try {
    const result = await redis.evalsha(scriptSha!, keys.length, ...keys, ...args);
    return result !== null ? Number(result) : null;
  } catch (err: any) {
    if (err.message && err.message.includes('NOSCRIPT')) {
      // Fallback to EVAL
      const result = await redis.eval(LUA_SCRIPT, keys.length, ...keys, ...args);
      return result !== null ? Number(result) : null;
    }
    throw err;
  }
}
