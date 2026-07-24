import React from 'react';

interface TimespanToggleProps {
  value: 'all-time' | '7-day';
  onChange: (timespan: 'all-time' | '7-day') => void;
}

export const TimespanToggle: React.FC<TimespanToggleProps> = ({ value, onChange }) => {
  return (
    <div className="filter-group">
      <label>Timespan</label>
      <div className="toggle-container" data-testid="timespan-toggle">
        <button
          type="button"
          className={`toggle-btn ${value === 'all-time' ? 'active' : ''}`}
          onClick={() => onChange('all-time')}
        >
          All-time
        </button>
        <button
          type="button"
          className={`toggle-btn ${value === '7-day' ? 'active' : ''}`}
          onClick={() => onChange('7-day')}
        >
          7-Day Window
        </button>
      </div>
    </div>
  );
};
