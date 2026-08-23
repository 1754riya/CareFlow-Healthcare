// TimeSelect.jsx
import React, { useMemo } from 'react';

export function TimeSelect({ value, onChange, label, interval = 30 }) {
  // Memoize the times array to avoid recalculating on every render
  const times = useMemo(() => {
    const generatedTimes = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')}`;
        generatedTimes.push(timeString);
      }
    }
    return generatedTimes;
  }, [interval]);

  return (
    <div className="flex flex-col">
      {label && (
        <label className="mb-1 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        aria-label={label || 'Select time'}
      >
        <option value="" disabled>
          Select Time
        </option>
        {times.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
    </div>
  );
}