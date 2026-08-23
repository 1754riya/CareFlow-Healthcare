import { useState, useEffect } from 'react';
import { FiTrash, FiPlus } from 'react-icons/fi';
import { Switch } from './Switch';
import { TimeSelect } from './TimeSelect';

export function DayTimeRange({ day, onChange }) {
  const [isEnabled, setIsEnabled] = useState(day !== 'Saturday' && day !== 'Sunday');
  const [timeRanges, setTimeRanges] = useState([{ start: '09:00', end: '17:00' }]);

  // Handle the toggle switch for enabling/disabling the day
  const handleIsEnabledChange = (value) => {
    setIsEnabled(value);
    if (value) {
      onChange(day, timeRanges);
    } else {
      onChange(day, null);
    }
  };

  // Add a new time range
  const addTimeRange = () => {
    const newRanges = [...timeRanges, { start: '09:00', end: '17:00' }];
    setTimeRanges(newRanges);
    if (isEnabled) {
      onChange(day, newRanges);
    }
  };

  // Update a specific time range
  const updateTimeRange = (index, field, value) => {
    const newRanges = timeRanges.map((range, i) => {
      if (i === index) {
        return { ...range, [field]: value };
      }
      return range;
    });
    setTimeRanges(newRanges);
    if (isEnabled) {
      onChange(day, newRanges);
    }
  };

  // Remove a time range
  const removeTimeRange = (index) => {
    const newRanges = timeRanges.filter((_, i) => i !== index);
    setTimeRanges(newRanges);
    if (isEnabled) {
      onChange(day, newRanges);
    }
  };

  // Initialize availability on mount
  useEffect(() => {
    if (isEnabled) {
      onChange(day, timeRanges);
    } else {
      onChange(day, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100">
      {/* Day Switch */}
      <div className="flex items-center">
        <Switch 
          checked={isEnabled} 
          onChange={handleIsEnabledChange} 
          label={day}
        />
      </div>
      
      {/* Time Ranges */}
      {isEnabled && (
        <div className="flex-1 space-y-4">
          {timeRanges.map((range, index) => (
            <div key={index} className="flex items-center gap-4">
              <TimeSelect
                label="Start Time"
                value={range.start}
                onChange={(value) => updateTimeRange(index, 'start', value)}
                interval={30}
              />
              <span className="text-gray-500">to</span>
              <TimeSelect
                label="End Time"
                value={range.end}
                onChange={(value) => updateTimeRange(index, 'end', value)}
                interval={30}
              />
              {/* Remove Time Range Button */}
              <button 
                className="p-2 text-red-500 hover:text-red-600"
                onClick={() => removeTimeRange(index)}
                aria-label="Remove time range"
              >
                <FiTrash className="w-5 h-5" />
              </button>
              {/* Add Time Range Button */}
              {index === timeRanges.length - 1 && (
                <button 
                  className="p-2 text-green-500 hover:text-green-600"
                  onClick={addTimeRange}
                  aria-label="Add time range"
                >
                  <FiPlus className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}