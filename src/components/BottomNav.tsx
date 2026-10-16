import React from 'react';
import { Calendar, CloudSun, Compass, Crosshair, Eye } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; hash: string }[] = [
    {
      id: 'calendar',
      label: 'Calendar',
      icon: <Calendar className="w-5 h-5" />,
      hash: '#tabCalendar',
    },
    {
      id: 'weather',
      label: 'Weather',
      icon: <CloudSun className="w-5 h-5" />,
      hash: '#tabWeather',
    },
    {
      id: 'route',
      label: 'Logistics',
      icon: <Compass className="w-5 h-5" />,
      hash: '#tabRoute',
    },
    {
      id: 'targets',
      label: 'Target Ops',
      icon: <Crosshair className="w-5 h-5" />,
      hash: '#tabTargets',
    },
    {
      id: 'sky',
      label: 'Sky Vizor',
      icon: <Eye className="w-5 h-5" />,
      hash: '#tabSky',
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t border-theme bg-[var(--theme-nav-bg)] px-2 py-1 select-none transition-colors"
      style={{ minHeight: '56px' }}
      aria-label="Chroma Nocta Main Navigation"
    >
      <div className="max-w-xl mx-auto grid grid-cols-5 gap-1 h-full items-center">
        {tabs.map((tab) => {
          const isActive =
            activeTab === tab.id || (tab.id === 'weather' && activeTab === 'fieldWeather');
          return (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                window.location.hash = tab.hash;
              }}
              className={`flex flex-col items-center justify-center py-1.5 min-w-0 px-0.5 rounded-xl transition-all relative group cursor-pointer ${
                isActive
                  ? 'text-theme-primary'
                  : 'text-theme-muted hover:text-[var(--theme-text)]'
              }`}
              style={{ minHeight: '48px' }}
            >
              {isActive && (
                <div className="absolute -top-1 w-8 h-1 rounded-full bg-theme-primary glow-primary" />
              )}
              <div
                className={`transition-transform duration-150 shrink-0 ${
                  isActive ? 'scale-110' : 'group-hover:scale-105'
                }`}
              >
                {tab.icon}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-medium tracking-tight mt-0.5 truncate max-w-full whitespace-nowrap transition-colors ${
                  isActive ? 'font-bold text-theme-primary' : 'text-theme-muted'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
