import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Orbit } from 'lucide-react';
import { SolarEphemerisDay } from '../types';
import { getSolarCoordinates, getLunarCoordinates, getHorizontalCoordinates, calculateNightEphemeris } from '../lib/ephemeris';
import { siteNoon, siteParts, formatSiteTimeHM, addDaysToDateKey } from '../lib/siteTime';
import { getSmoothSplinePath } from '../lib/splinePath';
import { MONTHS_SHORT_EN } from '../lib/calendarNames';
import { degToCompass } from '../lib/weatherService';

export interface AltitudeCurveProps {
  days: readonly SolarEphemerisDay[];
  latitude: number;
  longitude: number;
  timeZone: string;
  horizonProfile?: readonly number[];
}

const VIEW_BOX_HEIGHT = 360;
const PAD_LEFT = 45;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 45;
const PLOT_INNER_PAD = 16;
const PLOT_HEIGHT = VIEW_BOX_HEIGHT - PAD_TOP - PAD_BOTTOM;

function altToY(alt: number): number {
  const clamped = Math.max(-92, Math.min(92, alt));
  return PAD_TOP + ((92 - clamped) / 184) * PLOT_HEIGHT;
}

const ALT_MARKS: readonly number[] = [90, 60, 30, 0, -30, -60, -90];

const THREE_HOUR_TICKS: readonly number[] = [
  0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72,
];

const MIDNIGHT_OFFSETS: readonly number[] = [12, 36, 60];

// Fractional midpoints between midnights: [6/72, 24/72, 48/72, 66/72]
const DATE_MIDPOINTS: readonly number[] = [6, 24, 48, 66];

interface MoonDaySegment {
  dIdx: number;
  path: string;
  strokeWidth: number;
  opacity: number;
}

export const AltitudeCurve: React.FC<AltitudeCurveProps> = ({
  days,
  latitude,
  longitude,
  timeZone,
  horizonProfile,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(640);
  const [scrubRatio, setScrubRatio] = useState<number>(0.1667);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const scrollAnimRef = useRef<number | null>(null);
  const scrollDirRef = useRef<-1 | 0 | 1>(0);
  const touchStartXRef = useRef<number>(0);
  const touchStartScrollLeftRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const dayPlotWidth = Math.max(260, containerWidth - PAD_LEFT - PAD_RIGHT);
  const plotWidth = dayPlotWidth * 3;
  const viewBoxWidth = PAD_LEFT + PLOT_INNER_PAD + plotWidth + PAD_RIGHT;

  const resolvedDays = useMemo(() => {
    if (!days || days.length === 0) return [];
    if (days.length >= 3) return days;
    const first = days[0];
    if (!first) return days;
    const profileMutable = horizonProfile ? [...horizonProfile] : undefined;
    const full: SolarEphemerisDay[] = [...days];
    for (let offset = days.length; offset < 3; offset++) {
      const nextKey = addDaysToDateKey(first.dateKey, offset);
      full.push(
        calculateNightEphemeris(
          nextKey,
          latitude,
          longitude,
          0,
          timeZone,
          profileMutable
        )
      );
    }
    return full;
  }, [days, latitude, longitude, timeZone, horizonProfile]);

  const baseDay = resolvedDays[0] ?? days[0];
  const startMs = useMemo(() => {
    if (!baseDay) return 0;
    return siteNoon(baseDay.dateKey, timeZone).getTime();
  }, [baseDay, timeZone]);

  const totalDurationMs = 72 * 3600 * 1000;
  const endMs = useMemo(() => startMs + totalDurationMs, [startMs, totalDurationMs]);

  const sunPoints = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    if (!resolvedDays || resolvedDays.length === 0 || totalDurationMs <= 0) return pts;
    for (let d = 0; d < resolvedDays.length; d++) {
      const day = resolvedDays[d];
      if (!day) continue;
      const dayStartMs = siteNoon(day.dateKey, timeZone).getTime();
      const count = day.timeline.length;
      for (let i = 0; i < count; i++) {
        const seg = day.timeline[i];
        if (!seg) continue;
        const ptMs = dayStartMs + (i / Math.max(1, count - 1)) * 24 * 3600 * 1000;
        const frac = (ptMs - startMs) / totalDurationMs;
        if (frac >= 0 && frac <= 1) {
          const x = PAD_LEFT + PLOT_INNER_PAD + frac * plotWidth;
          const y = altToY(seg.sunAltitude);
          pts.push({ x, y });
        }
      }
    }
    return pts;
  }, [resolvedDays, startMs, totalDurationMs, timeZone, plotWidth]);

  const sunPath = useMemo(() => getSmoothSplinePath(sunPoints), [sunPoints]);

  const galCorePoints = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    if (!resolvedDays || resolvedDays.length === 0 || totalDurationMs <= 0) return pts;
    const stepCount = 144;
    for (let i = 0; i <= stepCount; i++) {
      const ptMs = startMs + (i / stepCount) * totalDurationMs;
      const t = new Date(ptMs);
      const horiz = getHorizontalCoordinates(t, 17.7611, -29.0078, latitude, longitude);
      const frac = (ptMs - startMs) / totalDurationMs;
      if (frac >= 0 && frac <= 1) {
        const x = PAD_LEFT + PLOT_INNER_PAD + frac * plotWidth;
        const y = altToY(horiz.altitude);
        pts.push({ x, y });
      }
    }
    return pts;
  }, [resolvedDays, startMs, totalDurationMs, latitude, longitude, plotWidth]);

  const galCorePath = useMemo(() => getSmoothSplinePath(galCorePoints), [galCorePoints]);

  const galCoreAreaPath = useMemo(() => {
    if (galCorePoints.length < 2) return '';
    const first = galCorePoints[0];
    const last = galCorePoints[galCorePoints.length - 1];
    if (!first || !last) return '';
    const curveD = getSmoothSplinePath(galCorePoints);
    const yHorizon = altToY(0);
    return `${curveD} L ${last.x} ${yHorizon} L ${first.x} ${yHorizon} Z`;
  }, [galCorePoints]);

  const mergedMoonlessSpans = useMemo(() => {
    interface MoonlessSpan {
      startX: number;
      endX: number;
    }
    const spans: MoonlessSpan[] = [];
    if (!resolvedDays || resolvedDays.length === 0 || totalDurationMs <= 0) return spans;

    let spanStartMs: number | null = null;
    let spanEndMs: number | null = null;

    for (let d = 0; d < resolvedDays.length; d++) {
      const day = resolvedDays[d];
      if (!day) continue;
      const dayStart = siteNoon(day.dateKey, timeZone).getTime();
      const count = day.timeline.length;
      if (count < 2) continue;

      for (let i = 0; i < count - 1; i++) {
        const seg = day.timeline[i];
        if (!seg) continue;
        const isMoonless = seg.sunAltitude <= -18 && seg.moonAltitude <= 0;
        const segStart = dayStart + (i / (count - 1)) * 24 * 3600 * 1000;
        const segEnd = dayStart + ((i + 1) / (count - 1)) * 24 * 3600 * 1000;

        if (isMoonless) {
          if (spanStartMs === null) {
            spanStartMs = segStart;
            spanEndMs = segEnd;
          } else {
            spanEndMs = segEnd;
          }
        } else {
          if (spanStartMs !== null && spanEndMs !== null) {
            const fracStart = (spanStartMs - startMs) / totalDurationMs;
            const fracEnd = (spanEndMs - startMs) / totalDurationMs;
            spans.push({
              startX: PAD_LEFT + PLOT_INNER_PAD + Math.max(0, fracStart) * plotWidth,
              endX: PAD_LEFT + PLOT_INNER_PAD + Math.min(1, fracEnd) * plotWidth,
            });
            spanStartMs = null;
            spanEndMs = null;
          }
        }
      }
    }

    if (spanStartMs !== null && spanEndMs !== null) {
      const fracStart = (spanStartMs - startMs) / totalDurationMs;
      const fracEnd = (spanEndMs - startMs) / totalDurationMs;
      spans.push({
        startX: PAD_LEFT + PLOT_INNER_PAD + Math.max(0, fracStart) * plotWidth,
        endX: PAD_LEFT + PLOT_INNER_PAD + Math.min(1, fracEnd) * plotWidth,
      });
    }

    return spans;
  }, [resolvedDays, startMs, totalDurationMs, timeZone, plotWidth]);

  const astroDarkSpans = useMemo(() => {
    interface DarkSpan {
      startX: number;
      endX: number;
    }
    const spans: DarkSpan[] = [];
    if (!resolvedDays || resolvedDays.length === 0 || totalDurationMs <= 0) return spans;

    let spanStartMs: number | null = null;
    let spanEndMs: number | null = null;

    for (let d = 0; d < resolvedDays.length; d++) {
      const day = resolvedDays[d];
      if (!day) continue;
      const dayStart = siteNoon(day.dateKey, timeZone).getTime();
      const count = day.timeline.length;
      if (count < 2) continue;

      for (let i = 0; i < count - 1; i++) {
        const seg = day.timeline[i];
        if (!seg) continue;
        const isAstroDark = seg.sunAltitude <= -18;
        const segStart = dayStart + (i / (count - 1)) * 24 * 3600 * 1000;
        const segEnd = dayStart + ((i + 1) / (count - 1)) * 24 * 3600 * 1000;

        if (isAstroDark) {
          if (spanStartMs === null) {
            spanStartMs = segStart;
            spanEndMs = segEnd;
          } else {
            spanEndMs = segEnd;
          }
        } else {
          if (spanStartMs !== null && spanEndMs !== null) {
            const fracStart = (spanStartMs - startMs) / totalDurationMs;
            const fracEnd = (spanEndMs - startMs) / totalDurationMs;
            spans.push({
              startX: PAD_LEFT + PLOT_INNER_PAD + Math.max(0, fracStart) * plotWidth,
              endX: PAD_LEFT + PLOT_INNER_PAD + Math.min(1, fracEnd) * plotWidth,
            });
            spanStartMs = null;
            spanEndMs = null;
          }
        }
      }
    }

    if (spanStartMs !== null && spanEndMs !== null) {
      const fracStart = (spanStartMs - startMs) / totalDurationMs;
      const fracEnd = (spanEndMs - startMs) / totalDurationMs;
      spans.push({
        startX: PAD_LEFT + PLOT_INNER_PAD + Math.max(0, fracStart) * plotWidth,
        endX: PAD_LEFT + PLOT_INNER_PAD + Math.min(1, fracEnd) * plotWidth,
      });
    }

    return spans;
  }, [resolvedDays, startMs, totalDurationMs, timeZone, plotWidth]);

  const moonDaySegments = useMemo(() => {
    const segments: MoonDaySegment[] = [];
    if (!resolvedDays || resolvedDays.length === 0 || totalDurationMs <= 0) return segments;

    for (let d = 0; d < resolvedDays.length; d++) {
      const day = resolvedDays[d];
      if (!day) continue;
      const dayStartMs = siteNoon(day.dateKey, timeZone).getTime();
      const count = day.timeline.length;
      const pts: { x: number; y: number }[] = [];

      for (let i = 0; i < count; i++) {
        const seg = day.timeline[i];
        if (!seg) continue;
        const ptMs = dayStartMs + (i / Math.max(1, count - 1)) * 24 * 3600 * 1000;
        const frac = (ptMs - startMs) / totalDurationMs;
        if (frac >= 0 && frac <= 1) {
          const x = PAD_LEFT + PLOT_INNER_PAD + frac * plotWidth;
          const y = altToY(seg.moonAltitude);
          pts.push({ x, y });
        }
      }

      const nextDay = resolvedDays[d + 1];
      if (nextDay && nextDay.timeline.length > 0) {
        const firstNextSeg = nextDay.timeline[0];
        if (firstNextSeg) {
          const nextDayStartMs = siteNoon(nextDay.dateKey, timeZone).getTime();
          const fracNext = (nextDayStartMs - startMs) / totalDurationMs;
          if (fracNext >= 0 && fracNext <= 1) {
            pts.push({
              x: PAD_LEFT + PLOT_INNER_PAD + fracNext * plotWidth,
              y: altToY(firstNextSeg.moonAltitude),
            });
          }
        }
      }

      const path = getSmoothSplinePath(pts);
      const strokeWidth = 1.4 + (day.moonIllumination / 100) * 1.6;
      const opacity = 0.6 + (day.moonIllumination / 100) * 0.4;

      segments.push({
        dIdx: d,
        path,
        strokeWidth,
        opacity,
      });
    }
    return segments;
  }, [resolvedDays, startMs, totalDurationMs, timeZone, plotWidth]);

  const activeDayIndex = Math.min(
    Math.max(0, resolvedDays.length - 1),
    Math.max(0, Math.floor(scrubRatio * 3))
  );
  const activeDay = resolvedDays[activeDayIndex] ?? baseDay;

  const sessionDateLabels = useMemo(() => {
    return DATE_MIDPOINTS.map((hCenter) => {
      const t = new Date(startMs + hCenter * 3600 * 1000);
      const p = siteParts(t, timeZone);
      const mName = MONTHS_SHORT_EN[p.month - 1] ?? '';
      const dateStr = `${p.day} ${mName} ${p.year}`;
      const rawX = PAD_LEFT + PLOT_INNER_PAD + (hCenter / 72) * plotWidth;
      const x = Math.max(PAD_LEFT + PLOT_INNER_PAD + 36, Math.min(PAD_LEFT + PLOT_INNER_PAD + plotWidth - 36, rawX));
      return { hCenter, dateStr, x };
    });
  }, [startMs, timeZone, plotWidth]);

  const updateScrub = useCallback((clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xInSvg = ((clientX - rect.left) / rect.width) * viewBoxWidth;
    const ratio = Math.max(0, Math.min(1, (xInSvg - PAD_LEFT - PLOT_INNER_PAD) / plotWidth));
    setScrubRatio(ratio);

    const c = containerRef.current;
    if (c) {
      const cRect = c.getBoundingClientRect();
      const distLeft = clientX - cRect.left;
      const distRight = cRect.right - clientX;
      if (distLeft < 40) {
        scrollDirRef.current = -1;
      } else if (distRight < 40) {
        scrollDirRef.current = 1;
      } else {
        scrollDirRef.current = 0;
      }
    }
  }, [viewBoxWidth, plotWidth]);

  const stopScrollLoop = useCallback(() => {
    scrollDirRef.current = 0;
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  }, []);

  const startScrollLoop = useCallback(() => {
    if (scrollAnimRef.current !== null) return;
    const step = () => {
      const c = containerRef.current;
      const dir = scrollDirRef.current;
      if (c && dir !== 0) {
        c.scrollLeft += dir * 12.0;
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
      }
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    return () => {
      stopScrollLoop();
    };
  }, [stopScrollLoop]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsScrubbing(true);
    updateScrub(e.clientX);
    if (e.pointerType === 'touch') {
      touchStartXRef.current = e.clientX;
      touchStartScrollLeftRef.current = containerRef.current ? containerRef.current.scrollLeft : 0;
    } else {
      startScrollLoop();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isScrubbing) {
      if (e.pointerType === 'touch') {
        const dx = touchStartXRef.current - e.clientX;
        if (containerRef.current) {
          containerRef.current.scrollLeft = touchStartScrollLeftRef.current + dx;
        }
        updateScrub(e.clientX);
      } else {
        updateScrub(e.clientX);
        startScrollLoop();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsScrubbing(false);
    stopScrollLoop();
    if (e.pointerType !== 'touch') {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const scrubTelemetry = useMemo(() => {
    const currentMs = startMs + scrubRatio * totalDurationMs;
    const t = new Date(currentMs);

    const sunCoords = getSolarCoordinates(t);
    const sunHoriz = getHorizontalCoordinates(t, sunCoords.ra, sunCoords.dec, latitude, longitude);

    const moonCoords = getLunarCoordinates(t);
    const moonHoriz = getHorizontalCoordinates(t, moonCoords.ra, moonCoords.dec, latitude, longitude);

    const tPlus = new Date(currentMs + 60 * 1000);
    const tMinus = new Date(currentMs - 60 * 1000);

    const sCoordsPlus = getSolarCoordinates(tPlus);
    const sHorizPlus = getHorizontalCoordinates(tPlus, sCoordsPlus.ra, sCoordsPlus.dec, latitude, longitude);
    const sCoordsMinus = getSolarCoordinates(tMinus);
    const sHorizMinus = getHorizontalCoordinates(tMinus, sCoordsMinus.ra, sCoordsMinus.dec, latitude, longitude);
    const sunRate = (sHorizPlus.altitude - sHorizMinus.altitude) * 30;

    const mCoordsPlus = getLunarCoordinates(tPlus);
    const mHorizPlus = getHorizontalCoordinates(tPlus, mCoordsPlus.ra, mCoordsPlus.dec, latitude, longitude);
    const mCoordsMinus = getLunarCoordinates(tMinus);
    const mHorizMinus = getHorizontalCoordinates(tMinus, mCoordsMinus.ra, mCoordsMinus.dec, latitude, longitude);
    const moonRate = (mHorizPlus.altitude - mHorizMinus.altitude) * 30;

    const sunAz = Math.round(((sunHoriz.azimuth % 360) + 360) % 360) % 360;
    const sunCardinal = degToCompass(sunAz);
    const moonAz = Math.round(((moonHoriz.azimuth % 360) + 360) % 360) % 360;
    const moonCardinal = degToCompass(moonAz);

    const galHoriz = getHorizontalCoordinates(t, 17.7611, -29.0078, latitude, longitude);
    const gCoordsPlus = getHorizontalCoordinates(tPlus, 17.7611, -29.0078, latitude, longitude);
    const gCoordsMinus = getHorizontalCoordinates(tMinus, 17.7611, -29.0078, latitude, longitude);
    const galCoreRate = (gCoordsPlus.altitude - gCoordsMinus.altitude) * 30;
    const galCoreAz = Math.round(((galHoriz.azimuth % 360) + 360) % 360) % 360;
    const galCoreCardinal = degToCompass(galCoreAz);

    const p = siteParts(t, timeZone);
    const hh = String(p.hour).padStart(2, '0');
    const mm = String(p.minute).padStart(2, '0');
    const timeHM = `${hh}:${mm}`;

    const upcomingEvents: { label: string; timeMs: number }[] = [];
    for (let d = 0; d < resolvedDays.length; d++) {
      const day = resolvedDays[d];
      if (!day) continue;
      if (day.sunset) upcomingEvents.push({ label: 'Sunset', timeMs: day.sunset.getTime() });
      if (day.astroDusk) upcomingEvents.push({ label: 'Astro Dark', timeMs: day.astroDusk.getTime() });
      if (day.astroDawn) upcomingEvents.push({ label: 'Dawn', timeMs: day.astroDawn.getTime() });
      if (day.sunrise) upcomingEvents.push({ label: 'Sunrise', timeMs: day.sunrise.getTime() });
      if (day.moonrise) upcomingEvents.push({ label: 'Moonrise', timeMs: day.moonrise.getTime() });
      if (day.moonset) upcomingEvents.push({ label: 'Moonset', timeMs: day.moonset.getTime() });
    }

    upcomingEvents.sort((a, b) => a.timeMs - b.timeMs);

    let nextEventBadge = 'Cycle Complete';
    let nextEventType: 'sun' | 'moon' | 'darkness' | 'none' = 'none';
    for (let i = 0; i < upcomingEvents.length; i++) {
      const ev = upcomingEvents[i];
      if (ev && ev.timeMs > currentMs) {
        const diffMs = ev.timeMs - currentMs;
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        nextEventBadge = h > 0 ? `${ev.label} in ${h}h ${m}m` : `${ev.label} in ${m}m`;
        if (ev.label === 'Sunset' || ev.label === 'Sunrise') {
          nextEventType = 'sun';
        } else if (ev.label === 'Moonrise' || ev.label === 'Moonset') {
          nextEventType = 'moon';
        } else {
          nextEventType = 'darkness';
        }
        break;
      }
    }

    return {
      timeHM,
      nextEventBadge,
      nextEventType,
      sunAlt: sunHoriz.altitude,
      moonAlt: moonHoriz.altitude,
      galCoreAlt: galHoriz.altitude,
      sunRate,
      moonRate,
      galCoreRate,
      sunAz,
      sunCardinal,
      moonAz,
      moonCardinal,
      galCoreAz,
      galCoreCardinal,
      scrubX: PAD_LEFT + PLOT_INNER_PAD + scrubRatio * plotWidth,
      sunY: altToY(sunHoriz.altitude),
      moonY: altToY(moonHoriz.altitude),
      galCoreY: altToY(galHoriz.altitude),
    };
  }, [startMs, scrubRatio, totalDurationMs, latitude, longitude, timeZone, resolvedDays, plotWidth]);

  const sunsetInfo = useMemo(() => {
    if (!activeDay || !activeDay.sunset) return null;
    const ms = activeDay.sunset.getTime();
    if (ms < startMs || ms > endMs) return null;
    const x = PAD_LEFT + PLOT_INNER_PAD + ((ms - startMs) / totalDurationMs) * plotWidth;
    const time = formatSiteTimeHM(activeDay.sunset, timeZone);
    return { x, time };
  }, [activeDay, startMs, endMs, totalDurationMs, timeZone, plotWidth]);

  const sunriseInfo = useMemo(() => {
    if (!activeDay || !activeDay.sunrise) return null;
    const ms = activeDay.sunrise.getTime();
    if (ms < startMs || ms > endMs) return null;
    const x = PAD_LEFT + PLOT_INNER_PAD + ((ms - startMs) / totalDurationMs) * plotWidth;
    const time = formatSiteTimeHM(activeDay.sunrise, timeZone);
    return { x, time };
  }, [activeDay, startMs, endMs, totalDurationMs, timeZone, plotWidth]);

  const moonriseInfo = useMemo(() => {
    if (!activeDay || !activeDay.moonrise) return null;
    const ms = activeDay.moonrise.getTime();
    if (ms < startMs || ms > endMs) return null;
    const x = PAD_LEFT + PLOT_INNER_PAD + ((ms - startMs) / totalDurationMs) * plotWidth;
    const time = formatSiteTimeHM(activeDay.moonrise, timeZone);
    return { x, time };
  }, [activeDay, startMs, endMs, totalDurationMs, timeZone, plotWidth]);

  const moonsetInfo = useMemo(() => {
    if (!activeDay || !activeDay.moonset) return null;
    const ms = activeDay.moonset.getTime();
    if (ms < startMs || ms > endMs) return null;
    const x = PAD_LEFT + PLOT_INNER_PAD + ((ms - startMs) / totalDurationMs) * plotWidth;
    const time = formatSiteTimeHM(activeDay.moonset, timeZone);
    return { x, time };
  }, [activeDay, startMs, endMs, totalDurationMs, timeZone, plotWidth]);

  const nadirInfo = useMemo(() => {
    if (!activeDay || activeDay.timeline.length === 0) return null;
    let minSeg = activeDay.timeline[0];
    for (let i = 1; i < activeDay.timeline.length; i++) {
      const seg = activeDay.timeline[i];
      if (seg && minSeg && seg.sunAltitude < minSeg.sunAltitude) {
        minSeg = seg;
      }
    }
    if (!minSeg) return null;
    return { time: formatSiteTimeHM(minSeg.time, timeZone) };
  }, [activeDay, timeZone]);

  const y0 = altToY(0);
  const yMinus18 = altToY(-18);
  const skyHeight = Math.max(0, y0 - PAD_TOP);

  // Rozet Çarpışma Çözücü (Badge Collision Resolver: Prevents Sun/Moon/GalCore overlap)
  const resolvedBadges = useMemo(() => {
    const BADGE_HEIGHT = 16;
    const MIN_GAP = 20;
    const minY = PAD_TOP + 2;
    const maxY = PAD_TOP + PLOT_HEIGHT - BADGE_HEIGHT - 2;

    const calcDefaultY = (pinY: number): number => {
      return pinY < PAD_TOP + 24 ? pinY + 8 : pinY - 22;
    };

    const list: { id: 'sun' | 'moon' | 'gal'; defaultY: number }[] = [
      { id: 'sun', defaultY: calcDefaultY(scrubTelemetry.sunY) },
      { id: 'moon', defaultY: calcDefaultY(scrubTelemetry.moonY) },
      { id: 'gal', defaultY: calcDefaultY(scrubTelemetry.galCoreY) },
    ];

    list.sort((a, b) => a.defaultY - b.defaultY);

    const pos0 = list[0];
    const pos1 = list[1];
    const pos2 = list[2];
    if (!pos0 || !pos1 || !pos2) {
      return {
        sunBadgeY: calcDefaultY(scrubTelemetry.sunY),
        moonBadgeY: calcDefaultY(scrubTelemetry.moonY),
        galBadgeY: calcDefaultY(scrubTelemetry.galCoreY),
      };
    }

    let y0Pos = pos0.defaultY;
    let y1Pos = pos1.defaultY;
    let y2Pos = pos2.defaultY;

    if (y1Pos < y0Pos + MIN_GAP) y1Pos = y0Pos + MIN_GAP;
    if (y2Pos < y1Pos + MIN_GAP) y2Pos = y1Pos + MIN_GAP;

    if (y2Pos > maxY) {
      y2Pos = maxY;
      if (y1Pos > y2Pos - MIN_GAP) y1Pos = y2Pos - MIN_GAP;
      if (y0Pos > y1Pos - MIN_GAP) y0Pos = y1Pos - MIN_GAP;
    }

    if (y0Pos < minY) {
      y0Pos = minY;
      if (y1Pos < y0Pos + MIN_GAP) y1Pos = y0Pos + MIN_GAP;
      if (y2Pos < y1Pos + MIN_GAP) y2Pos = y1Pos + MIN_GAP;
    }

    let sunY = y0Pos;
    let moonY = y1Pos;
    let galY = y2Pos;

    const assigned = [
      { id: pos0.id, y: y0Pos },
      { id: pos1.id, y: y1Pos },
      { id: pos2.id, y: y2Pos },
    ];

    for (let i = 0; i < assigned.length; i++) {
      const item = assigned[i];
      if (!item) continue;
      if (item.id === 'sun') sunY = item.y;
      else if (item.id === 'moon') moonY = item.y;
      else if (item.id === 'gal') galY = item.y;
    }

    return {
      sunBadgeY: sunY,
      moonBadgeY: moonY,
      galBadgeY: galY,
    };
  }, [scrubTelemetry.sunY, scrubTelemetry.moonY, scrubTelemetry.galCoreY]);

  const sunBadgeX = Math.max(PAD_LEFT + PLOT_INNER_PAD + 2, Math.min(PAD_LEFT + PLOT_INNER_PAD + plotWidth - 46, scrubTelemetry.scrubX - 22));
  const sunBadgeY = resolvedBadges.sunBadgeY;

  const moonBadgeX = Math.max(PAD_LEFT + PLOT_INNER_PAD + 2, Math.min(PAD_LEFT + PLOT_INNER_PAD + plotWidth - 46, scrubTelemetry.scrubX - 22));
  const moonBadgeY = resolvedBadges.moonBadgeY;

  const galBadgeX = Math.max(PAD_LEFT + PLOT_INNER_PAD + 2, Math.min(PAD_LEFT + PLOT_INNER_PAD + plotWidth - 46, scrubTelemetry.scrubX - 22));
  const galBadgeY = resolvedBadges.galBadgeY;

  let eventBadgeColorClass = 'text-slate-300 border border-slate-500/40 bg-slate-950/50';
  if (scrubTelemetry.nextEventType === 'sun') {
    eventBadgeColorClass = 'text-amber-300 border border-amber-500/40 bg-amber-950/50';
  } else if (scrubTelemetry.nextEventType === 'moon') {
    eventBadgeColorClass = 'text-cyan-300 border border-cyan-500/40 bg-cyan-950/50';
  } else if (scrubTelemetry.nextEventType === 'darkness') {
    eventBadgeColorClass = 'text-indigo-300 border border-indigo-500/40 bg-indigo-950/50';
  }

  if (!baseDay) return null;

  return (
    <div className="w-full flex flex-col rounded-2xl border border-theme bg-[var(--theme-card)]/80 p-3 sm:p-4 shadow-lg backdrop-blur-md">
      {/* Header & Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Orbit className="w-4 h-4 text-theme-primary shrink-0" />
          <span className="text-sm sm:text-base font-mono font-extrabold uppercase tracking-wider text-theme-primary">
            CELESTIAL ELEVATION CHART
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-slate-300">Sun</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-1.5 rounded-full bg-[#38bdf8]" />
            <span className="text-slate-300">Moon</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-1.5 rounded-full bg-[#e879f9]" />
            <span className="text-slate-300">Galactic Core</span>
          </div>
        </div>
      </div>

      {/* Edge-Pan Scrollable SVG Container (Dynamic 1-Day Viewport Lock) */}
      <div
        ref={containerRef}
        className="relative w-full overflow-x-auto touch-pan-x scrollbar-none select-none h-[360px]"
      >
        <div className="relative inline-block" style={{ width: `${viewBoxWidth}px`, height: `${VIEW_BOX_HEIGHT}px` }}>
          {/* Sticky Left Y-Axis Elevation Degree Scale */}
          <div
            className="sticky left-0 top-0 z-20 pointer-events-none inline-block align-top"
            style={{ width: `${PAD_LEFT}px`, height: `${VIEW_BOX_HEIGHT}px`, marginRight: `-${PAD_LEFT}px` }}
          >
            <svg
              width={PAD_LEFT}
              height={VIEW_BOX_HEIGHT}
              viewBox={`0 0 ${PAD_LEFT} ${VIEW_BOX_HEIGHT}`}
              className="block pointer-events-none"
            >
              <rect
                x={0}
                y={0}
                width={PAD_LEFT}
                height={PAD_TOP + PLOT_HEIGHT}
                fill="var(--theme-card)"
                fillOpacity={0.94}
                className="backdrop-blur-sm"
              />
              <line
                x1={PAD_LEFT}
                y1={PAD_TOP}
                x2={PAD_LEFT}
                y2={PAD_TOP + PLOT_HEIGHT}
                stroke="rgba(30, 41, 59, 0.45)"
                strokeWidth="1"
              />
              {ALT_MARKS.map((alt) => {
                const y = altToY(alt);
                return (
                  <text
                    key={`sticky-alt-label-${alt}`}
                    x={PAD_LEFT - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="rgba(148, 163, 184, 0.95)"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {alt > 0 ? `+${alt}°` : `${alt}°`}
                  </text>
                );
              })}
            </svg>
          </div>

          <svg
            ref={svgRef}
            width={viewBoxWidth}
            height={VIEW_BOX_HEIGHT}
            viewBox={`0 0 ${viewBoxWidth} ${VIEW_BOX_HEIGHT}`}
            className="max-w-none shrink-0 inline-block align-top cursor-crosshair"
            style={{
              width: `${viewBoxWidth}px`,
              minWidth: `${viewBoxWidth}px`,
              maxWidth: 'none',
              height: `${VIEW_BOX_HEIGHT}px`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
          <defs>
            <filter id="moonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#38bdf8" floodOpacity={0.85} />
            </filter>
            <filter id="silverGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#ffffff" floodOpacity={0.5} />
            </filter>
            <linearGradient id="moonlessAuroraGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.06" />
            </linearGradient>
            <clipPath id="skyAboveHorizonClip">
              <rect x={PAD_LEFT + PLOT_INNER_PAD} y={PAD_TOP} width={plotWidth} height={skyHeight} />
            </clipPath>
            <clipPath id="astroDarkSkyClip">
              {astroDarkSpans.map((sp, idx) => (
                <rect
                  key={`astro-dark-clip-${idx}`}
                  x={sp.startX}
                  y={PAD_TOP}
                  width={Math.max(1, sp.endX - sp.startX)}
                  height={skyHeight}
                />
              ))}
            </clipPath>
            <linearGradient id="galacticCoreNebulaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity="0.32" />
              <stop offset="65%" stopColor="#a855f7" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Layer A — Sub-Horizon Zones (Solid Horizontal Bands) */}
          {/* Twilight Corridor (0° to -18°): Solid distinct translucent steel-gray */}
          <rect
            x={PAD_LEFT + PLOT_INNER_PAD}
            y={y0}
            width={plotWidth}
            height={Math.max(0, yMinus18 - y0)}
            fill="rgba(30, 41, 59, 0.28)"
          />
          {/* Astro Dark Void (Below -18°): Solid distinct deep slate-navy */}
          <rect
            x={PAD_LEFT + PLOT_INNER_PAD}
            y={yMinus18}
            width={plotWidth}
            height={Math.max(0, PAD_TOP + PLOT_HEIGHT - yMinus18)}
            fill="#0c1425"
          />
          {[-30, -60, -90].map((subAlt) => {
            const subY = altToY(subAlt);
            return (
              <line
                key={`sub-grid-${subAlt}`}
                x1={PAD_LEFT + PLOT_INNER_PAD}
                y1={subY}
                x2={PAD_LEFT + PLOT_INNER_PAD + plotWidth}
                y2={subY}
                stroke="rgba(148, 163, 184, 0.12)"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Layer B — Above 0° Sky Region ONLY */}
          {/* Base Sky Background */}
          <rect
            x={PAD_LEFT + PLOT_INNER_PAD}
            y={PAD_TOP}
            width={plotWidth}
            height={skyHeight}
            fill="#020617"
          />

          {/* Vertical Timeline Stripes (Day Navy #0f1f3d [legacy #172554], Twilight Purple #1e1b4b [legacy #3b0764], Night Black #030712 [legacy #020617] bounded strictly to skyHeight) */}
          {resolvedDays.map((dItem, dIdx) => {
            const dayStart = siteNoon(dItem.dateKey, timeZone).getTime();
            const count = dItem.timeline.length;
            if (count < 2) return null;
            return dItem.timeline.slice(0, -1).map((seg, i) => {
              if (!seg) return null;
              const segStartMs = dayStart + (i / (count - 1)) * 24 * 3600 * 1000;
              const segEndMs = dayStart + ((i + 1) / (count - 1)) * 24 * 3600 * 1000;
              const fracStart = (segStartMs - startMs) / totalDurationMs;
              const fracEnd = (segEndMs - startMs) / totalDurationMs;
              const x = PAD_LEFT + PLOT_INNER_PAD + fracStart * plotWidth;
              const nextX = PAD_LEFT + PLOT_INNER_PAD + fracEnd * plotWidth;
              const w = Math.max(0.5, nextX - x);

              let fill = '#030712';
              if (seg.sunAltitude > 0) {
                fill = '#0f1f3d';
              } else if (seg.sunAltitude > -18) {
                fill = '#1e1b4b';
              }

              return (
                <rect
                  key={`stripe-${dIdx}-${i}`}
                  x={x}
                  y={PAD_TOP}
                  width={w}
                  height={skyHeight}
                  fill={fill}
                  shapeRendering="crispEdges"
                />
              );
            });
          })}

          {/* Moonless Dark Sky Glow Corridor (Moonless Astro Darkness: sunAltitude <= -18 && moonAltitude <= 0) */}
          {mergedMoonlessSpans.map((span, sIdx) => (
            <rect
              key={`moonless-merged-${sIdx}`}
              x={span.startX}
              y={PAD_TOP}
              width={Math.max(1, span.endX - span.startX)}
              height={skyHeight}
              fill="url(#moonlessAuroraGlow)"
            />
          ))}

          {/* Horizontal Reference Lines (Drawn cleanly OVER the background) */}
          {/* 0° Optical Horizon Line */}
          <line
            x1={PAD_LEFT + PLOT_INNER_PAD}
            y1={y0}
            x2={PAD_LEFT + PLOT_INNER_PAD + plotWidth}
            y2={y0}
            stroke="rgba(226, 232, 240, 0.75)"
            strokeWidth="0.75"
          />
          <text
            x={PAD_LEFT + PLOT_INNER_PAD + 6}
            y={y0 - 4}
            fill="rgba(255, 255, 255, 0.7)"
            fontSize="9"
            fontFamily="monospace"
          >
            Horizon
          </text>

          {/* -18° Astro Dark Threshold Line */}
          <line
            x1={PAD_LEFT + PLOT_INNER_PAD}
            y1={yMinus18}
            x2={PAD_LEFT + PLOT_INNER_PAD + plotWidth}
            y2={yMinus18}
            stroke="#38bdf8"
            strokeWidth="0.65"
          />
          <text
            x={PAD_LEFT + PLOT_INNER_PAD + 6}
            y={yMinus18 - 4}
            fill="rgba(56, 189, 248, 0.9)"
            fontSize="9"
            fontFamily="monospace"
          >
            Astro Dark
          </text>

          {/* Thin Silver Midnight (00:00) Lines with Subtle Glow */}
          {MIDNIGHT_OFFSETS.map((hOffset) => {
            const x = PAD_LEFT + PLOT_INNER_PAD + (hOffset / 72) * plotWidth;
            return (
              <line
                key={`midnight-line-${hOffset}`}
                x1={x}
                y1={PAD_TOP}
                x2={x}
                y2={PAD_TOP + PLOT_HEIGHT}
                stroke="#e2e8f0"
                strokeWidth="1.2"
                strokeDasharray="none"
                filter="url(#silverGlow)"
              />
            );
          })}

          {/* Half-Thickness Full Solid Vertical Gridlines for 3-Hour Interval Ticks */}
          {THREE_HOUR_TICKS.filter((h) => !MIDNIGHT_OFFSETS.includes(h) && h > 0 && h < 72).map((h) => {
            const x = PAD_LEFT + PLOT_INNER_PAD + (h / 72) * plotWidth;
            const hourInDay = (12 + h) % 24;
            const isNoon = hourInDay === 12;
            return (
              <line
                key={`tick-grid-${h}`}
                x1={x}
                y1={PAD_TOP}
                x2={x}
                y2={PAD_TOP + PLOT_HEIGHT}
                stroke={isNoon ? 'rgba(245, 158, 11, 0.35)' : 'rgba(148, 163, 184, 0.18)'}
                strokeWidth={isNoon ? '0.8' : '0.6'}
                strokeDasharray="none"
              />
            );
          })}

          {/* Clean Gridless Y-axis Labels on Left: +90, +60, +30, 0, -30, -60, -90 */}
          {ALT_MARKS.map((alt) => {
            const y = altToY(alt);
            return (
              <text
                key={`alt-label-${alt}`}
                x={PAD_LEFT - 6}
                y={y + 3}
                textAnchor="end"
                fill="rgba(148, 163, 184, 0.85)"
                fontSize="10"
                fontFamily="monospace"
              >
                {alt > 0 ? `+${alt}°` : `${alt}°`}
              </text>
            );
          })}

          {/* Row 1: X-Axis 3-Hour Interval Hours (Alt Eksen Saatleri) */}
          {THREE_HOUR_TICKS.map((h) => {
            const x = PAD_LEFT + PLOT_INNER_PAD + (h / 72) * plotWidth;
            const hourInDay = (12 + h) % 24;
            const isMidnight = hourInDay === 0;
            const isNoon = hourInDay === 12;
            const label = `${String(hourInDay).padStart(2, '0')}:00`;

            return (
              <text
                key={`tick-3h-${h}`}
                x={x}
                y={PAD_TOP + PLOT_HEIGHT + 14}
                textAnchor="middle"
                fill={isMidnight ? '#e2e8f0' : isNoon ? '#fbbf24' : 'rgba(148, 163, 184, 0.85)'}
                fontSize={isMidnight || isNoon ? '10' : '9.5'}
                fontFamily="monospace"
                fontWeight={isMidnight || isNoon ? 'bold' : 'normal'}
              >
                {label}
              </text>
            );
          })}

          {/* Row 2: Session Dates Placed at Fractional Midpoints [6/72, 24/72, 48/72, 66/72] */}
          {sessionDateLabels.map((lbl) => {
            return (
              <text
                key={`date-midpoint-${lbl.hCenter}`}
                x={lbl.x}
                y={PAD_TOP + PLOT_HEIGHT + 28}
                textAnchor="middle"
                fill="#38bdf8"
                fontSize="10.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {lbl.dateStr}
              </text>
            );
          })}

          {/* Minimal Rise/Set Crossing Badges (Time Only, Active Day Only) */}
          {(() => {
            const sunMarkerY = PAD_TOP + PLOT_HEIGHT - 18;
            const isMoonriseNearSun =
              (sunsetInfo !== null && Math.abs(moonriseInfo ? moonriseInfo.x - sunsetInfo.x : 999) < 48) ||
              (sunriseInfo !== null && Math.abs(moonriseInfo ? moonriseInfo.x - sunriseInfo.x : 999) < 48);
            const isMoonsetNearSun =
              (sunsetInfo !== null && Math.abs(moonsetInfo ? moonsetInfo.x - sunsetInfo.x : 999) < 48) ||
              (sunriseInfo !== null && Math.abs(moonsetInfo ? moonsetInfo.x - sunriseInfo.x : 999) < 48);

            const moonriseMarkerY = isMoonriseNearSun ? PAD_TOP + PLOT_HEIGHT - 36 : sunMarkerY;
            const moonsetMarkerY = isMoonsetNearSun ? PAD_TOP + PLOT_HEIGHT - 36 : sunMarkerY;
            const moonMarkerY = moonriseMarkerY;
            return (
              <>
                {sunsetInfo && (
                  <g key="sunset-marker">
                    <line
                      x1={sunsetInfo.x}
                      y1={y0}
                      x2={sunsetInfo.x}
                      y2={sunMarkerY}
                      stroke="rgba(245, 158, 11, 0.5)"
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                    />
                    <rect
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, sunsetInfo.x - 22))}
                      y={sunMarkerY}
                      width={44}
                      height={16}
                      rx={4}
                      fill="rgba(245, 158, 11, 0.2)"
                      stroke="#f59e0b"
                      strokeWidth={1}
                    />
                    <text
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, sunsetInfo.x - 22)) + 22}
                      y={sunMarkerY + 11.5}
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {sunsetInfo.time}
                    </text>
                  </g>
                )}

                {sunriseInfo && (
                  <g key="sunrise-marker">
                    <line
                      x1={sunriseInfo.x}
                      y1={y0}
                      x2={sunriseInfo.x}
                      y2={sunMarkerY}
                      stroke="rgba(245, 158, 11, 0.5)"
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                    />
                    <rect
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, sunriseInfo.x - 22))}
                      y={sunMarkerY}
                      width={44}
                      height={16}
                      rx={4}
                      fill="rgba(245, 158, 11, 0.2)"
                      stroke="#f59e0b"
                      strokeWidth={1}
                    />
                    <text
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, sunriseInfo.x - 22)) + 22}
                      y={sunMarkerY + 11.5}
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {sunriseInfo.time}
                    </text>
                  </g>
                )}

                {moonriseInfo && (
                  <g key="moonrise-marker">
                    <line
                      x1={moonriseInfo.x}
                      y1={y0}
                      x2={moonriseInfo.x}
                      y2={moonriseMarkerY}
                      stroke="rgba(56, 189, 248, 0.45)"
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                    />
                    <rect
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, moonriseInfo.x - 22))}
                      y={moonriseMarkerY}
                      width={44}
                      height={16}
                      rx={4}
                      fill="rgba(56, 189, 248, 0.2)"
                      stroke="#38bdf8"
                      strokeWidth={1}
                    />
                    <text
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, moonriseInfo.x - 22)) + 22}
                      y={moonriseMarkerY + 11.5}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {moonriseInfo.time}
                    </text>
                  </g>
                )}

                {moonsetInfo && (
                  <g key="moonset-marker">
                    <line
                      x1={moonsetInfo.x}
                      y1={y0}
                      x2={moonsetInfo.x}
                      y2={moonsetMarkerY}
                      stroke="rgba(56, 189, 248, 0.45)"
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                    />
                    <rect
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, moonsetInfo.x - 22))}
                      y={moonsetMarkerY}
                      width={44}
                      height={16}
                      rx={4}
                      fill="rgba(56, 189, 248, 0.2)"
                      stroke="#38bdf8"
                      strokeWidth={1}
                    />
                    <text
                      x={Math.max(PAD_LEFT + 2, Math.min(PAD_LEFT + plotWidth - 46, moonsetInfo.x - 22)) + 22}
                      y={moonsetMarkerY + 11.5}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {moonsetInfo.time}
                    </text>
                  </g>
                )}
              </>
            );
          })()}

          {/* Glowing Horizon Intersection Spheres (circle r="3.5" at y=y0) */}
          {sunsetInfo && (
            <circle
              key="sunset-sphere"
              cx={sunsetInfo.x}
              cy={y0}
              r="3.5"
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth="1"
              filter="url(#silverGlow)"
            />
          )}
          {sunriseInfo && (
            <circle
              key="sunrise-sphere"
              cx={sunriseInfo.x}
              cy={y0}
              r="3.5"
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth="1"
              filter="url(#silverGlow)"
            />
          )}
          {moonriseInfo && (
            <circle
              key="moonrise-sphere"
              cx={moonriseInfo.x}
              cy={y0}
              r="3.5"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="1"
              filter="url(#silverGlow)"
            />
          )}
          {moonsetInfo && (
            <circle
              key="moonset-sphere"
              cx={moonsetInfo.x}
              cy={y0}
              r="3.5"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="1"
              filter="url(#silverGlow)"
            />
          )}

          {/* Sun Curve */}
          {sunPath && (
            <path
              d={sunPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Moon Curves (Continuous per-day illumination stroke width & glow) */}
          {moonDaySegments.map((seg) => {
            if (!seg.path) return null;
            return (
              <path
                key={`moon-segment-${seg.dIdx}`}
                d={seg.path}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={seg.strokeWidth}
                opacity={seg.opacity}
                filter="url(#moonGlow)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Galactic Core Nebula Area Fill */}
          {galCoreAreaPath && (
            <path
              d={galCoreAreaPath}
              fill="url(#galacticCoreNebulaGrad)"
              clipPath="url(#astroDarkSkyClip)"
            />
          )}

          {/* Galactic Core Curve (Sgr A* RA 17.7611, Dec -29.0078) */}
          {galCorePath && (
            <path
              d={galCorePath}
              fill="none"
              stroke="#e879f9"
              strokeWidth="2.2"
              strokeDasharray="6 3"
              opacity={0.95}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}


          {/* Scrubber Hairline */}
          <line
            x1={scrubTelemetry.scrubX}
            y1={PAD_TOP}
            x2={scrubTelemetry.scrubX}
            y2={PAD_TOP + PLOT_HEIGHT}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />

          {/* Floating Altitude Pins */}
          <g key="galcore-pin">
            <circle
              cx={scrubTelemetry.scrubX}
              cy={scrubTelemetry.galCoreY}
              r="3.5"
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <rect
              x={galBadgeX}
              y={galBadgeY}
              width="44"
              height="16"
              rx="4"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#c084fc"
              strokeWidth={1}
            />
            <text
              x={galBadgeX + 22}
              y={galBadgeY + 11.5}
              textAnchor="middle"
              fill="#c084fc"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {scrubTelemetry.galCoreAlt > 0 ? `+${scrubTelemetry.galCoreAlt.toFixed(1)}°` : `${scrubTelemetry.galCoreAlt.toFixed(1)}°`}
            </text>
          </g>

          <g key="sun-pin">
            <circle
              cx={scrubTelemetry.scrubX}
              cy={scrubTelemetry.sunY}
              r="4"
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <rect
              x={sunBadgeX}
              y={sunBadgeY}
              width="44"
              height="16"
              rx="4"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#f59e0b"
              strokeWidth={1}
            />
            <text
              x={sunBadgeX + 22}
              y={sunBadgeY + 11.5}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {scrubTelemetry.sunAlt > 0 ? `+${scrubTelemetry.sunAlt.toFixed(1)}°` : `${scrubTelemetry.sunAlt.toFixed(1)}°`}
            </text>
          </g>

          <g key="moon-pin">
            <circle
              cx={scrubTelemetry.scrubX}
              cy={scrubTelemetry.moonY}
              r="4"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <rect
              x={moonBadgeX}
              y={moonBadgeY}
              width="44"
              height="16"
              rx="4"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#38bdf8"
              strokeWidth={1}
            />
            <text
              x={moonBadgeX + 22}
              y={moonBadgeY + 11.5}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {scrubTelemetry.moonAlt > 0 ? `+${scrubTelemetry.moonAlt.toFixed(1)}°` : `${scrubTelemetry.moonAlt.toFixed(1)}°`}
            </text>
          </g>
        </svg>
        </div>
      </div>

      {/* 2-Row Responsive Telemetry Footer */}
      <div className="flex flex-col mt-2 rounded-xl border border-slate-800/80 bg-black/50 overflow-hidden font-mono select-none">
        {/* Row 1: Time & Contextual Event Badge */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Time:</span>
            <span className="text-slate-100 font-bold text-sm tracking-wider">{scrubTelemetry.timeHM}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Next:</span>
            <span
              className={`px-2 py-0.5 rounded-md font-bold text-xs w-[165px] shrink-0 text-center justify-center flex items-center ${eventBadgeColorClass}`}
            >
              {scrubTelemetry.nextEventBadge}
            </span>
          </div>
        </div>

        {/* Row 2: Celestial Velocity (°/h rates) with Azimuth & Terrain Telemetry */}
        <div className="flex flex-wrap items-center justify-center gap-3 px-3 py-1.5 text-[11px] bg-slate-950/40 text-slate-300">
          <div className="flex items-center gap-1">
            <span>☀️ Sun:</span>
            <span className={`font-bold ${scrubTelemetry.sunRate >= 0 ? 'text-amber-400' : 'text-amber-300/70'}`}>
              {scrubTelemetry.sunRate >= 0
                ? `+${scrubTelemetry.sunRate.toFixed(1)}°/h ⇗`
                : `${scrubTelemetry.sunRate.toFixed(1)}°/h ⇘`}
            </span>
            <span className="text-slate-400 font-normal">
              ({scrubTelemetry.sunAz}° {scrubTelemetry.sunCardinal})
            </span>
          </div>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-1">
            <span>🌙 Moon:</span>
            <span className={`font-bold ${scrubTelemetry.moonRate >= 0 ? 'text-sky-300' : 'text-sky-300/70'}`}>
              {scrubTelemetry.moonRate >= 0
                ? `+${scrubTelemetry.moonRate.toFixed(1)}°/h ⇗`
                : `${scrubTelemetry.moonRate.toFixed(1)}°/h ⇘`}
            </span>
            <span className="text-slate-400 font-normal">
              ({scrubTelemetry.moonAz}° {scrubTelemetry.moonCardinal})
            </span>
          </div>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-1">
            <span>🌌 Core:</span>
            <span className={`font-bold ${scrubTelemetry.galCoreRate >= 0 ? 'text-purple-300' : 'text-purple-300/70'}`}>
              {scrubTelemetry.galCoreRate >= 0
                ? `+${scrubTelemetry.galCoreRate.toFixed(1)}°/h ⇗`
                : `${scrubTelemetry.galCoreRate.toFixed(1)}°/h ⇘`}
            </span>
            <span className="text-slate-400 font-normal">
              ({scrubTelemetry.galCoreAz}° {scrubTelemetry.galCoreCardinal})
            </span>
          </div>
          {baseDay.hasActiveTerrainMask && (
            <>
              <span className="text-white/10">|</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-semibold">
                🏔️ Terrain Active
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
