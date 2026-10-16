import React, { useState, useEffect } from 'react';
import { X, Mountain, RotateCcw, Check } from 'lucide-react';
import { LocationData } from '../types';
import { saveStoredLocation } from '../lib/coordinateParser';

interface HorizonMaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationData;
  onUpdateHorizon: (newProfile: number[]) => void;
}

const DIRECTIONS = [
  { label: 'N (0°)', name: 'North' },
  { label: 'NE (45°)', name: 'Northeast' },
  { label: 'E (90°)', name: 'East' },
  { label: 'SE (135°)', name: 'Southeast' },
  { label: 'S (180°)', name: 'South' },
  { label: 'SW (225°)', name: 'Southwest' },
  { label: 'W (270°)', name: 'West' },
  { label: 'NW (315°)', name: 'Northwest' },
];

export const HorizonMaskModal: React.FC<HorizonMaskModalProps> = ({
  isOpen,
  onClose,
  location,
  onUpdateHorizon,
}) => {
  const [profile, setProfile] = useState<number[]>(() => {
    if (location.horizonProfile && location.horizonProfile.length === 8) {
      return [...location.horizonProfile];
    }
    return [0, 0, 0, 0, 0, 0, 0, 0];
  });

  useEffect(() => {
    if (location.horizonProfile && location.horizonProfile.length === 8) {
      setProfile([...location.horizonProfile]);
    } else {
      setProfile([0, 0, 0, 0, 0, 0, 0, 0]);
    }
  }, [isOpen, location]);

  if (!isOpen) return null;

  const handleSliderChange = (idx: number, val: number) => {
    const next = [...profile];
    next[idx] = val;
    setProfile(next);
  };

  const handlePreset = (type: 'flat' | 'hills' | 'mountains') => {
    if (type === 'flat') setProfile([0, 0, 0, 0, 0, 0, 0, 0]);
    else if (type === 'hills') setProfile([3, 4, 5, 4, 3, 4, 5, 4]);
    else if (type === 'mountains') setProfile([8, 12, 14, 10, 6, 9, 15, 11]);
  };

  const handleSave = () => {
    const updatedLoc: LocationData = {
      ...location,
      horizonProfile: profile,
    };
    saveStoredLocation(updatedLoc);
    window.dispatchEvent(new CustomEvent('chroma_location_changed', { detail: updatedLoc }));
    onUpdateHorizon(profile);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-theme bg-[var(--theme-card)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme/50 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--theme-primary)]/15 border border-theme flex items-center justify-center text-theme-primary shrink-0 glow-primary-subtle">
              <Mountain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="typo-section text-theme-primary flex items-center gap-1.5">
                Horizon Mask (Topographic & Obstacle Profile)
              </h2>
              <p className="text-[10px] text-theme-muted font-mono">
                {location.name.split(' ')[0]} • Mountain obstruction impact on Sun & Moon early setting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-white/10 hover:border-theme bg-white/5 hover:bg-white/10 text-theme-muted hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between gap-1.5 p-1 rounded-xl bg-black/50 border border-theme/50 text-xs font-mono">
            <button
              onClick={() => handlePreset('flat')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
            >
              Flat Horizon (0°)
            </button>
            <button
              onClick={() => handlePreset('hills')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-[var(--theme-primary)]/15 text-theme-accent transition-colors cursor-pointer"
            >
              Hills (~4°)
            </button>
            <button
              onClick={() => handlePreset('mountains')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-amber-500/15 text-amber-300 transition-colors cursor-pointer"
            >
              High Valley (~12°)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {DIRECTIONS.map((dir, idx) => (
              <div key={dir.label} className="p-2.5 rounded-xl bg-black/45 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold">{dir.label}</span>
                  <span className="text-theme-accent font-bold">{profile[idx]}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={profile[idx]}
                  onChange={(e) => handleSliderChange(idx, Number(e.target.value))}
                  className="w-full accent-[var(--theme-primary)] h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--theme-primary)]/10 border border-theme text-[10px] font-mono text-theme-accent">
            Surrounding topography blocks the Moon earlier before it reaches the true astronomical horizon, extending usable dark-sky duration.
          </div>
        </div>

        <div className="p-3 border-t border-theme/50 bg-black/40 flex items-center justify-between text-xs font-mono">
          <button
            onClick={() => setProfile([0, 0, 0, 0, 0, 0, 0, 0])}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl bg-[var(--theme-primary)] text-black font-bold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" /> Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

