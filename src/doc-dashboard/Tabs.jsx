import { clsx } from 'clsx';

const tabs = ['Upcoming', 'Past', 'Cancelled'];

export function BookingTabs({ activeTab, onTabChange }) {
  return (
    <div className="flex gap-2 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={clsx(
            'px-4 py-2 rounded-sm transition-colors flex-1',
            activeTab === tab
              ? 'bg-[#1abc9c] text-white'
              : 'hover:bg-gray-100'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}