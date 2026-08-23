import { NavLink } from 'react-router-dom';
import { Home, Search, Calendar, User } from 'lucide-react';

const links = [
  { to: '/',              icon: Home,          label: 'Home'        },
  { to: '/search',        icon: Search,        label: 'Search'      },
  { to: '/appointments',  icon: Calendar,      label: 'Bookings'    },
  { to: '/settings',      icon: User,          label: 'Profile'     },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 md:hidden pb-safe">
      <div className="grid grid-cols-4">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
