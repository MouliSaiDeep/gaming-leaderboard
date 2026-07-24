import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { LeaderboardEntry } from '../api.js';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  animatingRows: Record<string, 'up' | 'down'>;
}

// Custom score counter/roller to animate score increments
const ScoreRoller: React.FC<{ score: number }> = ({ score }) => {
  const [displayScore, setDisplayScore] = useState(score);
  const previousScoreRef = useRef(score);

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setDisplayScore(score);
      previousScoreRef.current = score;
      return;
    }

    const start = displayScore;
    const end = score;
    if (start === end) return;

    const duration = 500; // roll duration in ms
    const startTime = performance.now();

    let animationFrameId: number;

    const updateScore = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(start + (end - start) * progress);
      setDisplayScore(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateScore);
      } else {
        previousScoreRef.current = score;
      }
    };

    animationFrameId = requestAnimationFrame(updateScore);

    return () => cancelAnimationFrame(animationFrameId);
  }, [score]);

  return <span className="score-roller">{displayScore.toLocaleString()}</span>;
};

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries, animatingRows }) => {
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const rowPositionsRef = useRef<Record<string, number>>({});

  // Smooth FLIP layout transitions for row order changes
  useLayoutEffect(() => {
    if (!tableBodyRef.current) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const rows = tableBodyRef.current.children;
    const newPositions: Record<string, number> = {};

    // 1. First/Read: Measure old positions compared to new positions
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLTableRowElement;
      const userId = row.getAttribute('data-userid');
      if (!userId) continue;

      const rect = row.getBoundingClientRect();
      newPositions[userId] = rect.top;

      const oldTop = rowPositionsRef.current[userId];
      if (oldTop !== undefined && oldTop !== rect.top) {
        const deltaY = oldTop - rect.top;
        // Invert: shift back immediately
        row.style.transform = `translateY(${deltaY}px)`;
        row.style.transition = 'none';
      }
    }

    // 2. Play: Animate the transition back to the natural position in the next animation frame
    const rafId = requestAnimationFrame(() => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as HTMLTableRowElement;
        const userId = row.getAttribute('data-userid');
        if (!userId) continue;

        if (row.style.transform) {
          row.style.transform = '';
          row.style.transition = 'transform 400ms cubic-bezier(0.2, 0, 0, 1)';
        }
      }
    });

    rowPositionsRef.current = newPositions;

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [entries]);

  return (
    <div className="table-container">
      <table data-testid="leaderboard-table" className="leaderboard-table">
        <thead>
          <tr>
            <th className="th-rank">RANK</th>
            <th className="th-player">PLAYER ID</th>
            <th className="th-score">SCORE</th>
          </tr>
        </thead>
        <tbody ref={tableBodyRef}>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={3} className="no-data">
                NO PLAYERS ON RECORD
              </td>
            </tr>
          ) : (
            entries.map((entry) => {
              const animation = animatingRows[entry.user_id];
              const rowClass = animation === 'up'
                ? 'rank-change-up'
                : animation === 'down'
                ? 'rank-change-down'
                : '';

              return (
                <tr
                  key={entry.user_id}
                  data-userid={entry.user_id}
                  data-testid={`leaderboard-row-${entry.user_id}`}
                  className={`leaderboard-row ${rowClass}`}
                >
                  <td className="td-rank">
                    <span className={`rank-value rank-${entry.rank <= 3 ? entry.rank : 'other'}`}>
                      {entry.rank}
                    </span>
                  </td>
                  <td className="td-player">{entry.user_id}</td>
                  <td className="td-score">
                    <ScoreRoller score={entry.score} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
