import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Navigation,
  Settings,
  Calendar,
  CloudSun,
  Compass,
  Crosshair,
  Orbit,
  Eye,
} from 'lucide-react';
import { ActiveTab, LocationData } from '../types';
import { parseDateKey, weekdayOfDateKey, siteParts } from '../lib/siteTime';
import { MONTHS_SHORT_EN, WEEKDAYS_SHORT_EN } from '../lib/calendarNames';

export interface HeaderProps {
  location: LocationData;
  activeTab?: ActiveTab;
  onOpenLocationModal: () => void;
  onOpenSettingsModal: () => void;
  selectedNightKey?: string;
  timeZone?: string;
  onPrevNight?: () => void;
  onNextNight?: () => void;
  onResetToday?: () => void;
  onOpenCalendarModal?: () => void;
  onOpenBriefingModal?: () => void;
  isNightLock?: boolean;
  onToggleNightLock?: () => void;
}

export interface NoctaTriangleProps {
  direction: 'left' | 'right' | 'up' | 'down';
  className?: string;
}

export const NoctaTriangle: React.FC<NoctaTriangleProps> = ({
  direction,
  className = 'w-4 h-4',
}) => {
  let rotation = 0;
  if (direction === 'left') rotation = 180;
  else if (direction === 'up') rotation = -90;
  else if (direction === 'down') rotation = 90;

  return (
    <svg
      viewBox="22 4 86 100"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
      aria-hidden="true"
    >
      <path
        d="M28 22 C28 11, 40 5, 50 11 L98 41 C108 47, 108 61, 98 67 L50 97 C40 103, 28 97, 28 86 Z"
        fill="currentColor"
        fillOpacity="0.32"
        stroke="currentColor"
        strokeWidth="7.5"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const TAB_HEADER_TITLES: Readonly<Record<ActiveTab, string>> = {
  calendar: 'NIGHT CALENDAR',
  weather: 'FIELD WEATHER',
  fieldWeather: 'FIELD WEATHER',
  route: 'ROUTE & LOGISTICS',
  targets: 'TARGET OPS',
  sky: 'SKY VIZOR',
};

function renderTabHeaderIcon(tab: ActiveTab): React.ReactNode {
  const cls = 'w-5 h-5 text-theme-primary shrink-0';
  if (tab === 'weather' || tab === 'fieldWeather') return <CloudSun className={cls} />;
  if (tab === 'route') return <Compass className={cls} />;
  if (tab === 'targets') return <Crosshair className={cls} />;
  if (tab === 'sky') return <Orbit className={cls} />;
  return <Calendar className={cls} />;
}

export const LiveSiteClock: React.FC<{ tz: string }> = ({ tz }) => {
  const [siteLiveNow, setSiteLiveNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setSiteLiveNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const liveSiteClockString = useMemo(() => {
    const p = siteParts(siteLiveNow, tz);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  }, [siteLiveNow, tz]);

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-theme bg-[var(--theme-primary)]/10 text-theme-accent font-mono text-xs sm:text-sm font-bold glow-primary-subtle shrink-0"
      title={`Live Site Clock (${tz})`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)] animate-pulse" />
      <span>{liveSiteClockString}</span>
    </div>
  );
};

function formatNightKeyBadge(dateKey: string): string {
  try {
    const { year, month, day } = parseDateKey(dateKey);
    const weekday = weekdayOfDateKey(dateKey);
    const dayStr = String(day).padStart(2, '0');
    const mStr = MONTHS_SHORT_EN[month - 1] ?? '';
    const wStr = WEEKDAYS_SHORT_EN[weekday] ?? '';
    return `${dayStr}-${mStr}-${year} | ${wStr}`;
  } catch {
    return dateKey;
  }
}

export const Header: React.FC<HeaderProps> = ({
  location,
  activeTab = 'calendar',
  onOpenLocationModal,
  onOpenSettingsModal,
  selectedNightKey,
  timeZone,
  onPrevNight,
  onNextNight,
  onResetToday,
  onOpenCalendarModal,
  onOpenBriefingModal,
  isNightLock,
  onToggleNightLock,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const currentSectionTitle = TAB_HEADER_TITLES[activeTab];

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-md border-b border-theme bg-[var(--theme-card)]/92 px-3 py-2.5 transition-colors"
      style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Clickable Logo and Header Group returning to Launchpad Hub */}
          <div
            onClick={onOpenBriefingModal}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer group hover:opacity-90 transition-opacity select-none"
            title="Return to Chroma Nocta Launchpad"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onOpenBriefingModal) {
                onOpenBriefingModal();
              }
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-theme shadow-sm glow-primary-subtle bg-[var(--theme-primary)]/15 group-hover:scale-105 transition-transform">
              <NoctaTriangle direction="right" className="w-4 h-4 text-theme-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-extrabold tracking-wider text-base md:text-lg uppercase font-mono transition-colors ${
                    isOnline
                      ? 'text-theme-primary'
                      : 'text-slate-400 drop-shadow-none'
                  }`}
                >
                  CHROMA NOCTA
                </span>
                <span
                  className={`hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider transition-colors ${
                    isOnline
                      ? 'border border-theme text-theme-muted bg-black/30'
                      : 'text-amber-300 border border-amber-500/40 bg-amber-950/40'
                  }`}
                >
                  {isOnline ? 'V1.5 OPS' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-[10px] text-theme-muted truncate hidden xs:block">
                Astrophotography Field Station & Ephemeris
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Night-Vision Lock Toggle Button (T-18) */}
          {onToggleNightLock && (
            <button
              onClick={onToggleNightLock}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer relative group ${
                isNightLock
                  ? 'bg-red-950/80 border-red-500 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                  : 'bg-white/5 border-white/15 text-slate-300 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/20 active:scale-95'
              }`}
              title={
                isNightLock
                  ? 'Night-Vision Lock ACTIVE (Monochrome deep-red OLED protection) — Click to unlock'
                  : 'Toggle Red Night-Vision Lock (T-18 zero-blue light field protection)'
              }
              aria-label="Toggle Night-Vision Lock"
            >
              <Eye className={`w-4 h-4 transition-transform group-hover:scale-110 ${isNightLock ? 'text-red-400 animate-pulse' : ''}`} />
            </button>
          )}

          {/* Location Icon Button (Theme-Reactive) */}
          <button
            onClick={onOpenLocationModal}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--theme-primary)]/10 border border-theme text-theme-accent glow-primary-subtle hover:bg-[var(--theme-primary)]/20 active:scale-95 transition-all cursor-pointer relative group"
            title={`Observation Site: ${location.name} (Click to change)`}
            aria-label="Observation Site Selection"
          >
            <Navigation className="w-4 h-4 text-theme-primary group-hover:scale-110 transition-transform" />
          </button>

          {/* Settings Icon Button */}
          <button
            onClick={onOpenSettingsModal}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/15 hover:border-theme hover:bg-white/10 active:scale-95 text-theme-primary transition-all cursor-pointer"
            title="Station Settings & Themes"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-theme-primary hover:rotate-45 transition-transform" />
          </button>
        </div>
      </div>

      {/* Global Station Strip across all 5 tabs */}
      {selectedNightKey && (
        <div className="max-w-6xl mx-auto mt-2.5 pt-2.5 border-t border-theme/50 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono">
          {/* Sol Bölüm (Dinamik Sekme Başlığı) */}
          <div className="flex items-center justify-between md:justify-start gap-2 shrink-0 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {renderTabHeaderIcon(activeTab)}
              <span className="typo-section text-theme-primary truncate">
                {currentSectionTitle}
              </span>
            </div>
            {timeZone && (
              <div className="md:hidden shrink-0">
                <LiveSiteClock tz={timeZone} />
              </div>
            )}
          </div>

          {/* Orta Bölüm (Tam Ortalanmış Kontrastlı Tarih Kapsülü & İmza Nocta Üçgenleri) */}
          <div className="mx-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/80 border border-theme glow-primary-subtle">
            <button
              onClick={onPrevNight}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme active:scale-95 text-theme-primary transition-all cursor-pointer"
              title="Previous Night (-1d)"
              aria-label="Previous Night"
            >
              <NoctaTriangle direction="left" className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenCalendarModal}
              className="px-3 py-1 rounded-lg bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 border border-theme text-white font-extrabold text-xs sm:text-sm tracking-wide whitespace-nowrap active:scale-95 transition-all cursor-pointer"
              title="Click to open mini calendar picker"
            >
              {formatNightKeyBadge(selectedNightKey)}
            </button>
            <button
              onClick={onNextNight}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme active:scale-95 text-theme-primary transition-all cursor-pointer"
              title="Next Night (+1d)"
              aria-label="Next Night"
            >
              <NoctaTriangle direction="right" className="w-3.5 h-3.5" />
            </button>
            {onResetToday && (
              <button
                onClick={onResetToday}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-theme text-theme-accent font-extrabold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                title="Reset to current observation night"
              >
                Today
              </button>
            )}
          </div>

          {/* Sağ Bölüm (Canlı Saha Saati) */}
          <div className="hidden md:flex items-center justify-end shrink-0">
            {timeZone && <LiveSiteClock tz={timeZone} />}
          </div>
        </div>
      )}
    </header>
  );
};
