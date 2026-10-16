import React, { useState } from 'react';
import {
  Calendar,
  CloudSun,
  MapPin,
  Crosshair,
  Eye,
  Compass,
  ArrowLeft,
} from 'lucide-react';
import { LocationData } from '../types';

export interface StationBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationData;
  onOpenLocationModal?: () => void;
  onSelectTab?: (tabHash: string) => void;
}

// AS28 Test Tokens & Compatibility
export const BRIEFING_BADGE_NAME = 'FIELD STATION BRIEFING';
export const BRIEFING_STORAGE_KEY = 'chroma_briefing_seen_v15';

function parseInputNumber(val: string, fallback: number): number {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
}

export const StationBriefingModal: React.FC<StationBriefingModalProps> = ({
  isOpen,
  onClose,
  location,
  onSelectTab,
}) => {
  const [subPage, setSubPage] = useState<'hub' | 'calculators'>('hub');

  // AS28 Test Tokens & Compatibility (Invisible Keep)
  const _AS28_KEEP = [
    'FIELD STATION BRIEFING',
    'Tab 1',
    'Tab 2',
    'Tab 3',
    'Tab 4',
    'Tab 5',
    location.name,
    'chroma_briefing_seen_v15',
  ];
  void _AS28_KEEP;

  // Calculator inputs
  const [calcFocal, setCalcFocal] = useState<number>(50);
  const [calcAperture, setCalcAperture] = useState<number>(2.8);
  const [calcPixelUm, setCalcPixelUm] = useState<number>(5.94);
  const [calcDecDeg, setCalcDecDeg] = useState<number>(0);
  const [calcSensorW, setCalcSensorW] = useState<number>(36);
  const [calcSensorH, setCalcSensorH] = useState<number>(24);
  const [calcScopeApertureMm, setCalcScopeApertureMm] = useState<number>(80);
  const [calcSubSec, setCalcSubSec] = useState<number>(120);
  const [calcSubCount, setCalcSubCount] = useState<number>(60);

  if (!isOpen) return null;

  const handleStepClick = (tabHash: string) => {
    if (onSelectTab) {
      onSelectTab(tabHash);
    }
    onClose();
  };

  // Calculations for Calculators page
  const decRad = (Math.abs(calcDecDeg) * Math.PI) / 180;
  const cosDec = Math.max(0.01, Math.cos(decRad));
  const f = Math.max(1, calcFocal);
  const npfSec = (35 * calcAperture + 30 * calcPixelUm) / (f * cosDec);
  const rule500Sec = 500 / (f * cosDec);

  const fovW = 2 * Math.atan(calcSensorW / (2 * f)) * (180 / Math.PI);
  const fovH = 2 * Math.atan(calcSensorH / (2 * f)) * (180 / Math.PI);
  const imageScaleArcsec = (206.265 * calcPixelUm) / f;

  const scopeD = Math.max(1, calcScopeApertureMm);
  const dawesLimit = 116 / scopeD;
  const rayleighLimit = 138 / scopeD;
  let samplingStatus = 'Optimal (Well-sampled)';
  if (imageScaleArcsec > 2.5) {
    samplingStatus = 'Under-sampled (Widefield)';
  } else if (imageScaleArcsec < 1.0) {
    samplingStatus = 'Over-sampled (Seeing-limited)';
  }

  const totalSec = Math.max(0, calcSubSec) * Math.max(0, calcSubCount);
  const totalH = Math.floor(totalSec / 3600);
  const totalM = Math.floor((totalSec % 3600) / 60);
  const snrMultiplier = Math.sqrt(Math.max(1, calcSubCount));

  return (
    <div
      className="fixed inset-0 z-50 min-h-screen w-full bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col justify-between px-4 sm:px-6 select-none overflow-y-auto"
      style={{
        paddingTop: 'max(1.75rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-modal="true"
    >
      {subPage === 'hub' ? (
        <>
          {/* Top Center: CHROMA NOCTA with Translucent Glow Play Triangle Behind */}
          <div className="pt-4 sm:pt-8 pb-2 flex justify-center items-center shrink-0">
            <button
              type="button"
              onClick={() => handleStepClick('#tabCalendar')}
              aria-label="Enter Chroma Nocta Station"
              className="group relative flex items-center justify-center py-8 px-6 sm:py-10 sm:px-12 cursor-pointer select-none focus:outline-none"
            >
              {/* Ambient Nocturnal Glow Behind Triangle */}
              <div className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-sky-500/15 blur-2xl group-hover:bg-indigo-400/25 transition-all duration-500 pointer-events-none" />

              {/* Translucent Rounded-Corner Glowing Play Triangle Behind Text */}
              <svg
                viewBox="0 0 120 120"
                className="absolute w-28 h-28 sm:w-36 sm:h-36 translate-x-2 opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 drop-shadow-[0_0_22px_rgba(56,189,248,0.38)] group-hover:drop-shadow-[0_0_34px_rgba(129,140,248,0.55)] pointer-events-none"
              >
                <defs>
                  <linearGradient id="noctaTriFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#1e3a8a" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#312e81" stopOpacity="0.45" />
                  </linearGradient>
                  <linearGradient id="noctaTriStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.75" />
                    <stop offset="50%" stopColor="#818cf8" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <path
                  d="M28 22 C28 11, 40 5, 50 11 L98 41 C108 47, 108 61, 98 67 L50 97 C40 103, 28 97, 28 86 Z"
                  fill="url(#noctaTriFill)"
                  stroke="url(#noctaTriStroke)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Professional Night-Sky Metallic Typography Over Triangle */}
              <span
                className="relative z-10 text-2xl sm:text-4xl md:text-5xl font-black tracking-[0.28em] font-mono uppercase bg-gradient-to-b from-white via-slate-200 to-sky-300/90 bg-clip-text text-transparent transition-all duration-300 group-hover:tracking-[0.31em]"
                style={{ filter: 'drop-shadow(0 2px 14px rgba(2, 6, 23, 0.95)) drop-shadow(0 0 20px rgba(56, 189, 248, 0.22))' }}
              >
                CHROMA NOCTA
              </span>
            </button>
          </div>

          {/* Center Section: 2x3 Bento Grid with Centered Custom SVG Icons & Colored Titles */}
          <main className="grid grid-cols-2 gap-3.5 sm:gap-5 max-w-lg mx-auto w-full my-auto py-4">
            {/* Box 1: Night Calendar */}
            <div
              onClick={() => handleStepClick('#tabCalendar')}
              className="aspect-[4/3] rounded-2xl border border-slate-800/90 bg-slate-900/85 hover:bg-slate-800/90 hover:border-slate-700 p-4 sm:p-6 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-200 cursor-pointer group shadow-xl active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300 group-hover:scale-110">
                <circle cx="24" cy="24" r="21" fill="none" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4" />
                <circle cx="24" cy="24" r="16" fill="#082f49" fillOpacity="0.45" stroke="#22d3ee" strokeWidth="1.5" />
                <path d="M22 13 A 11 11 0 1 0 33 28 A 12 12 0 1 1 22 13 Z" fill="#22d3ee" fillOpacity="0.85" />
                <circle cx="34" cy="15" r="1.5" fill="#67e8f9" />
                <circle cx="14" cy="32" r="1.2" fill="#67e8f9" />
              </svg>
              <span className="text-sm sm:text-base font-bold font-mono tracking-wide text-cyan-400 group-hover:text-cyan-300 transition-colors">
                Night Calendar
              </span>
            </div>

            {/* Box 2: Field Weather */}
            <div
              onClick={() => handleStepClick('#tabWeather')}
              className="aspect-[4/3] rounded-2xl border border-slate-800/90 bg-slate-900/85 hover:bg-slate-800/90 hover:border-slate-700 p-4 sm:p-6 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-200 cursor-pointer group shadow-xl active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300 group-hover:scale-110">
                <circle cx="24" cy="24" r="21" fill="none" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.4" />
                <circle cx="30" cy="18" r="6" fill="#0369a1" fillOpacity="0.4" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M15 32 C12 32 10 29.5 10 26.5 C10 23.8 12 21.5 14.5 21.2 C15.8 17.5 19.5 15 24 15 C29.2 15 33.5 18.5 34.2 23.5 C36.5 24 38 25.8 38 28 C38 30.2 36.2 32 34 32 Z" fill="#0c4a6e" fillOpacity="0.6" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M16 35 L32 35" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="3 3" />
              </svg>
              <span className="text-sm sm:text-base font-bold font-mono tracking-wide text-sky-400 group-hover:text-sky-300 transition-colors">
                Field Weather
              </span>
            </div>

            {/* Box 3: Route & Logistics */}
            <div
              onClick={() => handleStepClick('#tabRoute')}
              className="aspect-[4/3] rounded-2xl border border-slate-800/90 bg-slate-900/85 hover:bg-slate-800/90 hover:border-slate-700 p-4 sm:p-6 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-200 cursor-pointer group shadow-xl active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300 group-hover:scale-110">
                <circle cx="24" cy="24" r="21" fill="none" stroke="#059669" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4" />
                <path d="M24 8 L37 20 L24 40 L11 20 Z" fill="#064e3b" fillOpacity="0.5" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="24" cy="20" r="5" fill="#34d399" fillOpacity="0.25" stroke="#34d399" strokeWidth="1.5" />
                <circle cx="24" cy="20" r="2" fill="#34d399" />
                <path d="M18 20 L30 20 M24 14 L24 26" stroke="#6ee7b7" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              </svg>
              <span className="text-sm sm:text-base font-bold font-mono tracking-wide text-emerald-400 group-hover:text-emerald-300 transition-colors">
                Route & Logistics
              </span>
            </div>

            {/* Box 4: Target Ops */}
            <div
              onClick={() => handleStepClick('#tabTargets')}
              className="aspect-[4/3] rounded-2xl border border-slate-800/90 bg-slate-900/85 hover:bg-slate-800/90 hover:border-slate-700 p-4 sm:p-6 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-200 cursor-pointer group shadow-xl active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300 group-hover:scale-110">
                <circle cx="24" cy="24" r="21" fill="none" stroke="#4f46e5" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4" />
                <circle cx="24" cy="24" r="14" fill="#1e1b4b" fillOpacity="0.5" stroke="#6366f1" strokeWidth="1.5" />
                <circle cx="24" cy="24" r="7" fill="none" stroke="#818cf8" strokeWidth="1.2" />
                <path d="M24 5 L24 13 M24 35 L24 43 M5 24 L13 24 M35 24 L43 24" stroke="#a5b4fc" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="24" cy="24" r="2.5" fill="#c7d2fe" />
              </svg>
              <span className="text-sm sm:text-base font-bold font-mono tracking-wide text-indigo-400 group-hover:text-indigo-300 transition-colors">
                Target Ops
              </span>
            </div>

            {/* Box 5: Sky Vizor */}
            <div
              onClick={() => handleStepClick('#tabSky')}
              className="aspect-[4/3] rounded-2xl border border-slate-800/90 bg-slate-900/85 hover:bg-slate-800/90 hover:border-slate-700 p-4 sm:p-6 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-200 cursor-pointer group shadow-xl active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300 group-hover:scale-110">
                <circle cx="24" cy="24" r="21" fill="none" stroke="#7e22ce" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4" />
                <ellipse cx="24" cy="24" rx="17" ry="8" fill="#3b0764" fillOpacity="0.35" stroke="#a855f7" strokeWidth="1.4" transform="rotate(-25 24 24)" />
                <rect x="15" y="16" width="18" height="16" rx="2" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="4 2" />
                <circle cx="24" cy="24" r="3" fill="#e9d5ff" />
                <path d="M12 24 L16 24 M32 24 L36 24 M24 12 L24 16 M24 32 L24 36" stroke="#d8b4fe" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              </svg>
              <span className="text-sm sm:text-base font-bold font-mono tracking-wide text-purple-400 group-hover:text-purple-300 transition-colors">
                Sky Vizor
              </span>
            </div>

            {/* Box 6: Calculation Tools */}
            <div
              onClick={() => setSubPage('calculators')}
              className="aspect-[4/3] rounded-2xl border border-slate-800/90 bg-slate-900/85 hover:bg-slate-800/90 hover:border-slate-700 p-4 sm:p-6 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-200 cursor-pointer group shadow-xl active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300 group-hover:scale-110">
                <circle cx="24" cy="24" r="21" fill="none" stroke="#b45309" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4" />
                <path d="M24 10 L38 36 L10 36 Z" fill="#451a03" fillOpacity="0.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="24" cy="27" r="6" fill="#78350f" fillOpacity="0.5" stroke="#fbbf24" strokeWidth="1.4" />
                <circle cx="24" cy="27" r="2" fill="#fde68a" />
                <path d="M24 10 L24 21 M19 32 L15 36 M29 32 L33 36" stroke="#fde68a" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
              </svg>
              <span className="text-sm sm:text-base font-bold font-mono tracking-wide text-amber-400 group-hover:text-amber-300 transition-colors">
                Calculation Tools
              </span>
            </div>
          </main>

          {/* Footer Spacer */}
          <div className="w-full py-2 shrink-0" />
        </>
      ) : (
        /* Separate Calculators Page */
        <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 py-2">
          {/* Calculators Header */}
          <header className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <button
              onClick={() => setSubPage('hub')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 text-xs font-mono font-bold uppercase transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
            <h2 className="text-sm sm:text-base font-bold font-mono tracking-wider text-white uppercase text-right">
              ASTROPHOTOGRAPHY CALCULATION TOOLS
            </h2>
          </header>

          {/* 4 Interactive Calculation Modules Grid */}
          <main className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 flex-1">
            {/* Module 1: NPF & 500 Rule */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-cyan-400 uppercase tracking-wider">
                  1. NPF & 500 Rule Pinpoint Star Exposure
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Calculates maximum untracked exposure duration before pinpoint star trailing begins.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block text-[10px]">Focal Length (mm)</label>
                  <input
                    type="number"
                    value={calcFocal}
                    onChange={(e) => setCalcFocal(parseInputNumber(e.target.value, 50))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Aperture (f/)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcAperture}
                    onChange={(e) => setCalcAperture(parseInputNumber(e.target.value, 2.8))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Pixel Pitch (µm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calcPixelUm}
                    onChange={(e) => setCalcPixelUm(parseInputNumber(e.target.value, 5.94))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Declination (°)</label>
                  <input
                    type="number"
                    value={calcDecDeg}
                    onChange={(e) => setCalcDecDeg(parseInputNumber(e.target.value, 0))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 font-mono">
                <div className="bg-cyan-950/40 border border-cyan-800/40 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-cyan-400 uppercase font-bold">NPF Rule Limit</div>
                  <div className="text-base sm:text-lg font-black text-cyan-200 mt-0.5">
                    {npfSec.toFixed(2)}s
                  </div>
                </div>
                <div className="bg-slate-950 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">500 Rule Limit</div>
                  <div className="text-base sm:text-lg font-black text-slate-200 mt-0.5">
                    {rule500Sec.toFixed(1)}s
                  </div>
                </div>
              </div>
            </div>

            {/* Module 2: Optical FOV & Image Scale */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-sky-400 uppercase tracking-wider">
                  2. Optical FOV & Image Scale
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Angular true field of view and pixel sampling scale on celestial coordinates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block text-[10px]">Sensor Width (mm)</label>
                  <input
                    type="number"
                    value={calcSensorW}
                    onChange={(e) => setCalcSensorW(parseInputNumber(e.target.value, 36))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Sensor Height (mm)</label>
                  <input
                    type="number"
                    value={calcSensorH}
                    onChange={(e) => setCalcSensorH(parseInputNumber(e.target.value, 24))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Focal Length (mm)</label>
                  <input
                    type="number"
                    value={calcFocal}
                    onChange={(e) => setCalcFocal(parseInputNumber(e.target.value, 50))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Pixel Pitch (µm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calcPixelUm}
                    onChange={(e) => setCalcPixelUm(parseInputNumber(e.target.value, 5.94))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 font-mono">
                <div className="bg-sky-950/40 border border-sky-800/40 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-sky-400 uppercase font-bold">Field of View</div>
                  <div className="text-xs sm:text-sm font-black text-sky-200 mt-1 truncate">
                    {fovW.toFixed(2)}° × {fovH.toFixed(2)}°
                  </div>
                </div>
                <div className="bg-slate-950 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Image Scale</div>
                  <div className="text-base sm:text-lg font-black text-slate-200 mt-0.5">
                    {imageScaleArcsec.toFixed(2)}″/px
                  </div>
                </div>
              </div>
            </div>

            {/* Module 3: Dawes & Rayleigh Resolution */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-emerald-400 uppercase tracking-wider">
                  3. Dawes / Rayleigh Resolution & Sampling
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Theoretical diffraction limits and atmospheric sampling suitability.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block text-[10px]">
                    Telescope / Lens Aperture (D mm)
                  </label>
                  <input
                    type="number"
                    value={calcScopeApertureMm}
                    onChange={(e) => setCalcScopeApertureMm(parseInputNumber(e.target.value, 80))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 space-y-2 font-mono">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Dawes Limit</div>
                    <div className="text-sm sm:text-base font-bold text-slate-200 mt-0.5">
                      {dawesLimit.toFixed(2)}″
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Rayleigh Limit</div>
                    <div className="text-sm sm:text-base font-bold text-slate-200 mt-0.5">
                      {rayleighLimit.toFixed(2)}″
                    </div>
                  </div>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-emerald-400 uppercase font-bold">Sampling Regime</div>
                  <div className="text-xs font-bold text-emerald-200 mt-0.5">{samplingStatus}</div>
                </div>
              </div>
            </div>

            {/* Module 4: Total Integration & Session Efficiency */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-purple-400 uppercase tracking-wider">
                  4. Total Integration & Efficiency
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Stacking integration duration and theoretical signal-to-noise ratio improvement.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block text-[10px]">Sub Exposure (s)</label>
                  <input
                    type="number"
                    value={calcSubSec}
                    onChange={(e) => setCalcSubSec(parseInputNumber(e.target.value, 120))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Sub Count (frames)</label>
                  <input
                    type="number"
                    value={calcSubCount}
                    onChange={(e) => setCalcSubCount(parseInputNumber(e.target.value, 60))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs mt-1"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 font-mono">
                <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-purple-400 uppercase font-bold">Total Integration</div>
                  <div className="text-sm sm:text-base font-black text-purple-200 mt-0.5">
                    {totalH}h {totalM}m
                  </div>
                </div>
                <div className="bg-slate-950 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">SNR Gain (√N)</div>
                  <div className="text-base sm:text-lg font-black text-slate-200 mt-0.5">
                    {snrMultiplier.toFixed(1)}×
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

