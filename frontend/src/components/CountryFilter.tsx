import React from 'react';

interface CountryFilterProps {
  value: string;
  onChange: (country: string) => void;
  disabled?: boolean;
}

const COUNTRIES = [
  { code: '', name: 'Global / All Countries' },
  { code: 'US', name: 'United States (US)' },
  { code: 'DE', name: 'Germany (DE)' },
  { code: 'JP', name: 'Japan (JP)' },
  { code: 'FR', name: 'France (FR)' },
  { code: 'BR', name: 'Brazil (BR)' },
  { code: 'IN', name: 'India (IN)' },
  { code: 'GB', name: 'United Kingdom (GB)' },
  { code: 'CA', name: 'Canada (CA)' },
  { code: 'AU', name: 'Australia (AU)' },
  { code: 'MX', name: 'Mexico (MX)' }
];

export const CountryFilter: React.FC<CountryFilterProps> = ({ value, onChange, disabled = false }) => {
  return (
    <div className="filter-group">
      <label htmlFor="country-select">Filter by Country</label>
      <select
        id="country-select"
        data-testid="country-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="glass-select"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
};
