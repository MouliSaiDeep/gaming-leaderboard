import { useState, useEffect, useCallback } from 'react';
import { fetchGlobalLeaderboard, fetchCountryLeaderboard, fetch7DayLeaderboard, LeaderboardEntry } from './api.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { LeaderboardTable } from './components/LeaderboardTable.js';
import { CountryFilter } from './components/CountryFilter.js';
import { TimespanToggle } from './components/TimespanToggle.js';

export default function App() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [country, setCountry] = useState<string>('');
  const [timespan, setTimespan] = useState<'all-time' | '7-day'>('all-time');
  const [animatingRows, setAnimatingRows] = useState<Record<string, 'up' | 'down'>>({});
  const [error, setError] = useState<string | null>(null);


  const loadLeaderboard = useCallback(async () => {
    try {
      setError(null);
      let data: LeaderboardEntry[];
      if (timespan === '7-day') {
        data = await fetch7DayLeaderboard();
      } else {
        if (country === '') {
          data = await fetchGlobalLeaderboard();
        } else {
          data = await fetchCountryLeaderboard(country);
        }
      }
      setEntries(data);
    } catch (err: any) {
      console.error('Error loading leaderboard:', err);
      setError('Could not load leaderboard data. Please try again later.');
    }
  }, [country, timespan]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);


  const handleRankUpdate = useCallback((data: { user_id: string; old_rank: number; new_rank: number; score: number }) => {
    // Only apply live updates on global all-time view, or if user is already present in the currently viewed list.
    // This maintains visual sanity for country lists.
    setEntries((prevEntries) => {
      const userIndex = prevEntries.findIndex((e) => e.user_id === data.user_id);
      
      if (userIndex === -1) {
        // If they are not in the current list, but their new rank would place them in the visible table,
        // we can trigger a reload to fetch the accurate state of the board.
        if (data.new_rank <= prevEntries.length) {
          loadLeaderboard();
        }
        return prevEntries;
      }

      const updated = [...prevEntries];
      const oldEntry = updated[userIndex];


      updated[userIndex] = {
        ...oldEntry,
        score: data.score,

      };


      updated.sort((a, b) => b.score - a.score);


      for (let i = 0; i < updated.length; i++) {
        updated[i].rank = i + 1;
      }

      // Check the rank shift direction.
      // Remember: new_rank < old_rank means they moved up (improved rank, e.g. 10 -> 7)
      const direction = data.new_rank < data.old_rank ? 'up' : 'down';

      setAnimatingRows((prev) => ({
        ...prev,
        [data.user_id]: direction
      }));


      setTimeout(() => {
        setAnimatingRows((prev) => {
          const copy = { ...prev };
          delete copy[data.user_id];
          return copy;
        });
      }, 1500);

      return updated;
    });
  }, [loadLeaderboard]);

  const isConnected = useWebSocket(handleRankUpdate);

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>AG Arena Leaderboard</h1>
          <div className="connection-status" data-connected={isConnected}>
            <span className="blinking-cursor"></span>
            {isConnected ? 'CONNECTED' : 'RECONNECTING'}
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="controls-panel glass-card">
          <TimespanToggle value={timespan} onChange={setTimespan} />
          
          <CountryFilter
            value={country}
            onChange={setCountry}
            disabled={timespan === '7-day'}
          />

          {timespan === '7-day' && (
            <div className="info-notice">
              ⚠️ Country filtering is only available on the All-time leaderboard.
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="leaderboard-panel glass-card">
          <h2 className="panel-title">
            {timespan === '7-day' ? 'Global 7-Day Window' : country === '' ? 'Global All-Time' : `${country} All-Time`}
          </h2>
          <LeaderboardTable entries={entries} animatingRows={animatingRows} />
        </div>
      </main>

      <footer className="dashboard-footer">
        Real-Time Gaming Leaderboard • Powered by Redis Sorted Sets & Streams
      </footer>
    </div>
  );
}
