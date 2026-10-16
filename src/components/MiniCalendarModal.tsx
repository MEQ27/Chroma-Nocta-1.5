import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { NoctaTriangle } from './Header';
import { calculateNightEphemeris } from '../lib/ephemeris';
import {
  siteParts,
  siteDateKey,
  currentNightKey,
  parseDateKey,
  zonedTimeToInstant,
} from '../lib/siteTime';
import { MONTHS_EN } from '../lib/calendarNames';

export const PreciseMoonIcon: React.FC<{
  phase: number;
  size?: number;
  className?: string;
  latitude?: number;
  isSouthern?: boolean;
}> = ({ phase, size = 18, className = '', latitude, isSouthern }) => {
  const isSouth = isSouthern ?? (typeof latitude === 'number' ? latitude < 0 : false);
  const p = ((phase % 1) + 1) % 1;
  const r = 46;
  const cx = 50;
  const cy = 50;

  if (p < 0.025 || p > 0.975) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`shrink-0 ${isSouth ? 'scale-x-[-1]' : ''} ${className}`}
        style={isSouth ? { transform: 'scaleX(-1)', transformOrigin: 'center' } : undefined}
      >
        <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={r - 4} fill="#0b0f19" />
      </svg>
    );
  }

  if (p >= 0.48 && p <= 0.52) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`shrink-0 ${isSouth ? 'scale-x-[-1]' : ''} ${className}`}
        style={isSouth ? { transform: 'scaleX(-1)', transformOrigin: 'center' } : undefined}
      >
        <circle cx={cx} cy={cy} r={r} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx={cx - 10} cy={cy - 10} r="6" fill="#f1f5f9" opacity="0.6" />
        <circle cx={cx + 12} cy={cy + 8} r="8" fill="#f1f5f9" opacity="0.6" />
      </svg>
    );
  }

  const angle = p * 2 * Math.PI;
  const c = Math.cos(angle);
  const rx = Math.max(0.5, Math.abs(c) * r);
  let pathD = '';

  if (p < 0.5) {
    const sweepTerm = p < 0.25 ? 0 : 1;
    pathD = `M 50 6 A 44 44 0 0 1 50 94 A ${rx.toFixed(2)} 44 0 0 ${sweepTerm} 50 6 Z`;
  } else {
    const sweepTerm = p < 0.75 ? 0 : 1;
    pathD = `M 50 6 A 44 44 0 0 0 50 94 A ${rx.toFixed(2)} 44 0 0 ${sweepTerm} 50 6 Z`;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 ${isSouth ? 'scale-x-[-1]' : ''} ${className}`}
      style={isSouth ? { transform: 'scaleX(-1)', transformOrigin: 'center' } : undefined}
    >
      <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
      <circle cx="37" cy="35" r="7" fill="#0f172a" opacity="0.45" />
      <circle cx="56" cy="37" r="8" fill="#0f172a" opacity="0.45" />
      <circle cx="47" cy="57" r="9" fill="#0f172a" opacity="0.4" />
      <path d={pathD} fill="#f8fafc" />
    </svg>
  );
};

export interface MiniCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  latitude: number;
  longitude: number;
  elevation: number;
  timeZone: string;
  siteTodayKey?: string;
  activeWindowDateKeys?: Set<string>;
  windowGroup?: 'early' | 'best' | 'late';
}

export const MiniCalendarModal: React.FC<MiniCalendarModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  latitude,
  longitude,
  elevation,
  timeZone,
  siteTodayKey,
  activeWindowDateKeys,
  windowGroup,
}) => {
  const tz = timeZone;
  const selParts = siteParts(selectedDate, tz);
  const [viewYear, setViewYear] = useState<number>(selParts.year);
  const [viewMonth, setViewMonth] = useState<number>(selParts.month - 1);

  useEffect(() => {
    if (isOpen) {
      const p = siteParts(selectedDate, tz);
      setViewYear(p.year);
      setViewMonth(p.month - 1);
    }
  }, [isOpen, selectedDate, tz]);

  const today = useMemo(() => {
    const key = siteTodayKey || currentNightKey(Date.now(), tz);
    const parts = parseDateKey(key);
    return zonedTimeToInstant(parts.year, parts.month, parts.day, 12, 0, 0, tz);
  }, [siteTodayKey, tz]);

  const monthData = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const firstDayOfWeek = (new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay() + 6) % 7;
    const days: {
      dayNum: number;
      dateKey: string;
      date: Date;
      phase: number;
      illumination: number;
      isNewMoon: boolean;
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = zonedTimeToInstant(viewYear, viewMonth + 1, d, 12, 0, 0, tz);
      const ephem = calculateNightEphemeris(curDate, latitude, longitude, elevation, tz);
      days.push({
        dayNum: d,
        dateKey: ephem.dateKey,
        date: curDate,
        phase: ephem.moonPhase,
        illumination: ephem.moonIllumination,
        isNewMoon: ephem.moonIllumination <= 15,
      });
    }

    return { firstDayOfWeek, daysInMonth, days };
  }, [viewYear, viewMonth, latitude, longitude, elevation, tz]);

  const selectedDayNum = selParts.day;

  const handleStepDay = (delta: number) => {
    const curParts = siteParts(selectedDate, tz);
    const nextDate = zonedTimeToInstant(curParts.year, curParts.month, curParts.day + delta, 12, 0, 0, tz);
    const nextParts = siteParts(nextDate, tz);
    setViewYear(nextParts.year);
    setViewMonth(nextParts.month - 1);
    onSelectDate(nextDate);
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleStepYear = (delta: number) => {
    setViewYear((y) => y + delta);
  };

  if (!isOpen) return null;

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-[92vw] sm:w-[85vw] md:w-[75vw] max-w-2xl rounded-2xl border border-theme bg-[var(--theme-card)] shadow-2xl p-4 sm:p-6 relative animate-in zoom-in-95 duration-150 text-[var(--theme-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-theme/50 mb-3">
          <span className="typo-section text-theme-primary flex items-center gap-2">
            <Calendar className="w-4 h-4 text-theme-primary shrink-0" />
            <span>Calendar Navigator</span>
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-white/10 hover:border-theme bg-white/5 hover:bg-white/10 text-theme-muted hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Column Independent Stepper (Day • Month • Year) with Signature NoctaTriangle */}
        <div className="flex justify-center mb-3 select-none">
          <div className="inline-flex items-center justify-center gap-2 sm:gap-3.5 mx-auto py-2 px-5 rounded-2xl bg-black/55 border border-theme shadow-inner">
            {/* Column 1: Day */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepDay(1)}
                aria-label="Next Day"
                className="w-7 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme text-theme-primary cursor-pointer active:scale-90 transition-all"
              >
                <NoctaTriangle direction="up" className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-extrabold text-white text-base min-w-[32px] text-center">
                {selectedDayNum}
              </span>
              <button
                type="button"
                onClick={() => handleStepDay(-1)}
                aria-label="Previous Day"
                className="w-7 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme text-theme-primary cursor-pointer active:scale-90 transition-all"
              >
                <NoctaTriangle direction="down" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Column 2: Month */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="w-7 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme text-theme-primary cursor-pointer active:scale-90 transition-all"
              >
                <NoctaTriangle direction="up" className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-extrabold text-white text-sm sm:text-base min-w-[92px] text-center capitalize">
                {MONTHS_EN[viewMonth]}
              </span>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="w-7 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme text-theme-primary cursor-pointer active:scale-90 transition-all"
              >
                <NoctaTriangle direction="down" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Column 3: Year */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepYear(1)}
                aria-label="Next Year"
                className="w-7 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme text-theme-primary cursor-pointer active:scale-90 transition-all"
              >
                <NoctaTriangle direction="up" className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-extrabold text-theme-accent text-sm sm:text-base min-w-[50px] text-center">
                {viewYear}
              </span>
              <button
                type="button"
                onClick={() => handleStepYear(-1)}
                aria-label="Previous Year"
                className="w-7 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-[var(--theme-primary)]/20 border border-white/10 hover:border-theme text-theme-primary cursor-pointer active:scale-90 transition-all"
              >
                <NoctaTriangle direction="down" className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] sm:text-xs uppercase mb-1">
          {weekdays.map((w, idx) => {
            const isWeekendHeader = idx >= 5;
            return (
              <div
                key={idx}
                className={
                  isWeekendHeader
                    ? 'text-theme-primary font-extrabold border-b-2 border-[var(--theme-primary)]/50 pb-1'
                    : 'text-theme-muted font-semibold py-1'
                }
              >
                {w}
              </div>
            );
          })}
        </div>

        {/* Fixed 6-Row (42 Slots) Rectangular Grid */}
        <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-xs">
          {Array.from({ length: monthData.firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-lead-${idx}`} className="h-11 sm:h-12 rounded-xl bg-white/[0.02] border border-white/[0.03]" />
          ))}
          {monthData.days.map(({ dayNum, dateKey, date, phase }) => {
            const isSelected = dateKey === siteDateKey(selectedDate, tz);
            const isToday = dateKey === (siteTodayKey || currentNightKey(Date.now(), tz));
            const colIdx = (monthData.firstDayOfWeek + dayNum - 1) % 7;
            const isWeekend = colIdx >= 5;

            return (
              <button
                key={dayNum}
                onClick={() => {
                  onSelectDate(date);
                  onClose();
                }}
                className={`h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center p-1 relative transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--theme-primary)] text-black font-extrabold shadow-md ring-2 ring-[var(--theme-accent)]'
                    : isToday
                    ? 'bg-white/15 text-white font-bold border border-theme glow-primary-subtle hover:bg-white/20'
                    : isWeekend
                    ? 'bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/35 text-white hover:bg-[var(--theme-primary)]/20'
                    : 'bg-black/45 border border-white/10 text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] sm:text-xs leading-tight font-bold">{dayNum}</span>
                <div className="mt-0.5">
                  <PreciseMoonIcon phase={phase} size={14} latitude={latitude} />
                </div>
              </button>
            );
          })}
          {Array.from({
            length: Math.max(0, 42 - monthData.firstDayOfWeek - monthData.days.length),
          }).map((_, idx) => (
            <div key={`empty-tail-${idx}`} className="h-11 sm:h-12 rounded-xl bg-white/[0.02] border border-white/[0.03]" />
          ))}
        </div>

        <div className="mt-3 pt-2.5 border-t border-theme/50 flex items-center justify-end font-mono">
          <button
            onClick={() => {
              onSelectDate(today);
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-[var(--theme-primary)]/15 hover:bg-[var(--theme-primary)]/25 border border-theme text-theme-primary font-mono font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );
};
