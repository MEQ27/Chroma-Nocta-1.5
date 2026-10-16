import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Crosshair,
  Search,
  Filter,
  Sparkles,
  Compass,
  Clock,
  Layers,
  ChevronRight,
  Info,
  Bell,
  Volume2,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  ShieldCheck,
  Mountain,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ResolvedSite } from '../../types';
import { siteDateKey, formatSiteTimeHM, formatSiteDateLabel } from '../../lib/siteTime';
import { calculateNightEphemeris, getHorizontalCoordinates } from '../../lib/ephemeris';
import { getSmoothSplinePath } from '../../lib/splinePath';
import { degToCompass } from '../../lib/weatherService';
import { HorizonMaskModal } from '../HorizonMaskModal';
import { NoctaTriangle } from '../Header';
import { saveStoredLocation } from '../../lib/coordinateParser';
import {
  AstroTargetItem,
  TargetCategoryFilter,
  getAllTargets,
  filterTargets,
  analyzeTargetForNight,
  ComprehensiveTargetAnalysis,
  TargetAltitudePoint,
} from '../../lib/targetOpsEngine';

export interface PresetTargetEntry {
  readonly name: string;
  readonly catalog: string;
  readonly categoryGroup: 'widefield' | 'nebula' | 'galaxy' | 'cluster';
  readonly constellation: string;
  readonly ra: number;
  readonly dec: number;
  readonly magnitude: number;
  readonly sizeArcmin: number;
  readonly recommendedFocal: string;
  readonly description: string;
}

export const PRESET_SEARCH_DICTIONARY: readonly PresetTargetEntry[] = [
  {
    name: 'Horsehead Nebula / Barnard 33',
    catalog: 'Barnard 33',
    categoryGroup: 'nebula',
    constellation: 'Orion',
    ra: 5.6817,
    dec: -2.4600,
    magnitude: 6.8,
    sizeArcmin: 60,
    recommendedFocal: '200mm - 400mm',
    description: 'Iconic dark nebula silhouetted against glowing emission nebula IC 434 in Orion.',
  },
  {
    name: 'Flame Nebula / NGC 2024',
    catalog: 'NGC 2024',
    categoryGroup: 'nebula',
    constellation: 'Orion',
    ra: 5.6983,
    dec: -1.8500,
    magnitude: 2.0,
    sizeArcmin: 30,
    recommendedFocal: '200mm - 400mm',
    description: 'Emission nebula energized by Alnitak with dramatic dark dust lanes.',
  },
  {
    name: 'Rosette Nebula / NGC 2237',
    catalog: 'NGC 2237',
    categoryGroup: 'nebula',
    constellation: 'Monoceros',
    ra: 6.5333,
    dec: 4.9667,
    magnitude: 5.5,
    sizeArcmin: 80,
    recommendedFocal: '135mm - 300mm',
    description: 'Vast spherical HII region surrounding open cluster NGC 2244.',
  },
  {
    name: 'California Nebula / NGC 1499',
    catalog: 'NGC 1499',
    categoryGroup: 'nebula',
    constellation: 'Perseus',
    ra: 4.0556,
    dec: 36.4167,
    magnitude: 6.0,
    sizeArcmin: 145,
    recommendedFocal: '85mm - 200mm',
    description: 'Giant emission nebula ionized by Menkhib, shaped like the state of California.',
  },
  {
    name: 'Bubble Nebula / NGC 7635',
    catalog: 'NGC 7635',
    categoryGroup: 'nebula',
    constellation: 'Cassiopeia',
    ra: 23.3467,
    dec: 61.2000,
    magnitude: 8.5,
    sizeArcmin: 15,
    recommendedFocal: '300mm - 600mm',
    description: 'Blown stellar wind bubble created by massive O-star SAO 20575.',
  },
  {
    name: 'Soul Nebula / IC 1848',
    catalog: 'IC 1848',
    categoryGroup: 'nebula',
    constellation: 'Cassiopeia',
    ra: 2.8556,
    dec: 60.4000,
    magnitude: 6.5,
    sizeArcmin: 120,
    recommendedFocal: '135mm - 300mm',
    description: 'Major star-forming HII complex paired with Heart Nebula in the Perseus Arm.',
  },
  {
    name: 'Elephant Trunk Nebula / IC 1396',
    catalog: 'IC 1396',
    categoryGroup: 'nebula',
    constellation: 'Cepheus',
    ra: 21.6111,
    dec: 57.5000,
    magnitude: 3.5,
    sizeArcmin: 170,
    recommendedFocal: '85mm - 200mm',
    description: 'Dense globule of gas and dust forming stars within ionization front of IC 1396.',
  },
  {
    name: 'Crescent Nebula / NGC 6888',
    catalog: 'NGC 6888',
    categoryGroup: 'nebula',
    constellation: 'Cygnus',
    ra: 20.2014,
    dec: 38.3500,
    magnitude: 7.4,
    sizeArcmin: 18,
    recommendedFocal: '250mm - 500mm',
    description: 'Wolf-Rayet bubble energized by WR 136 in the heart of Cygnus.',
  },
  {
    name: 'Iris Nebula / NGC 7023',
    catalog: 'NGC 7023',
    categoryGroup: 'nebula',
    constellation: 'Cepheus',
    ra: 21.0236,
    dec: 68.1667,
    magnitude: 6.8,
    sizeArcmin: 18,
    recommendedFocal: '200mm - 400mm',
    description: 'Bright blue reflection nebula illuminated by magnitude 7 star SAO 19158.',
  },
  {
    name: 'Wizard Nebula / NGC 7380',
    catalog: 'NGC 7380',
    categoryGroup: 'nebula',
    constellation: 'Cepheus',
    ra: 22.7833,
    dec: 58.1000,
    magnitude: 7.2,
    sizeArcmin: 25,
    recommendedFocal: '200mm - 400mm',
    description: 'Young open cluster embedded in active ionized nebulosity with intricate pillars.',
  },
  {
    name: 'Cone Nebula / NGC 2264',
    catalog: 'NGC 2264',
    categoryGroup: 'nebula',
    constellation: 'Monoceros',
    ra: 6.6850,
    dec: 9.9000,
    magnitude: 3.9,
    sizeArcmin: 20,
    recommendedFocal: '200mm - 400mm',
    description: 'Christmas Tree Cluster and triangular pillar of dark absorption gas.',
  },
  {
    name: 'Pinwheel Galaxy / M101',
    catalog: 'M101',
    categoryGroup: 'galaxy',
    constellation: 'Ursa Major',
    ra: 14.0533,
    dec: 54.3500,
    magnitude: 7.9,
    sizeArcmin: 28,
    recommendedFocal: '300mm - 800mm',
    description: 'Face-on grand design spiral galaxy with rich HII regions in spiral arms.',
  },
  {
    name: 'Whirlpool Galaxy / M51',
    catalog: 'M51',
    categoryGroup: 'galaxy',
    constellation: 'Canes Venatici',
    ra: 13.4983,
    dec: 47.1950,
    magnitude: 8.4,
    sizeArcmin: 11,
    recommendedFocal: '400mm - 1000mm',
    description: 'Interacting grand-design spiral galaxy connected to companion NGC 5195.',
  },
  {
    name: 'Sombrero Galaxy / M104',
    catalog: 'M104',
    categoryGroup: 'galaxy',
    constellation: 'Virgo',
    ra: 12.6664,
    dec: -11.6231,
    magnitude: 8.0,
    sizeArcmin: 9,
    recommendedFocal: '400mm - 1000mm',
    description: 'Unbarred spiral galaxy with prominent dust lane and enormous central bulge.',
  },
  {
    name: 'Double Cluster / NGC 869',
    catalog: 'NGC 869',
    categoryGroup: 'cluster',
    constellation: 'Perseus',
    ra: 2.3167,
    dec: 57.1500,
    magnitude: 3.7,
    sizeArcmin: 60,
    recommendedFocal: '135mm - 300mm',
    description: 'Spectacular twin open star clusters NGC 869 and NGC 884 in Perseus.',
  },
  {
    name: 'Omega Centauri / NGC 5139',
    catalog: 'NGC 5139',
    categoryGroup: 'cluster',
    constellation: 'Centaurus',
    ra: 13.4472,
    dec: -47.4767,
    magnitude: 3.9,
    sizeArcmin: 36,
    recommendedFocal: '200mm - 500mm',
    description: 'Largest and most luminous globular cluster in the Milky Way with millions of stars.',
  },
  {
    name: 'Tarantula Nebula / NGC 2070',
    catalog: 'NGC 2070',
    categoryGroup: 'nebula',
    constellation: 'Dorado',
    ra: 5.6444,
    dec: -69.0989,
    magnitude: 8.0,
    sizeArcmin: 40,
    recommendedFocal: '200mm - 500mm',
    description: 'Colossal extragalactic starburst HII region in the Large Magellanic Cloud.',
  },
  {
    name: 'Andromeda Galaxy / M31',
    catalog: 'M31',
    categoryGroup: 'galaxy',
    constellation: 'Andromeda',
    ra: 0.7122,
    dec: 41.2692,
    magnitude: 3.4,
    sizeArcmin: 180,
    recommendedFocal: '85mm - 300mm',
    description: 'Nearest major spiral galaxy to the Milky Way, spanning 3 degrees in the sky.',
  },
  {
    name: 'Orion Nebula / M42',
    catalog: 'M42',
    categoryGroup: 'nebula',
    constellation: 'Orion',
    ra: 5.5881,
    dec: -5.3911,
    magnitude: 4.0,
    sizeArcmin: 65,
    recommendedFocal: '135mm - 400mm',
    description: 'Diffuse nebula situated in the Milky Way south of Orion Belt.',
  },
  {
    name: 'Pleiades / M45',
    catalog: 'M45',
    categoryGroup: 'cluster',
    constellation: 'Taurus',
    ra: 3.7914,
    dec: 24.1050,
    magnitude: 1.6,
    sizeArcmin: 110,
    recommendedFocal: '50mm - 200mm',
    description: 'Seven Sisters open cluster embedded in electric-blue reflection nebulosity.',
  },
  {
    name: 'Heart Nebula / IC 1805',
    catalog: 'IC 1805',
    categoryGroup: 'nebula',
    constellation: 'Cassiopeia',
    ra: 2.5447,
    dec: 61.4500,
    magnitude: 6.5,
    sizeArcmin: 150,
    recommendedFocal: '135mm - 300mm',
    description: 'Vast emission nebula driven by young open cluster Melotte 15 in Perseus arm.',
  },
  {
    name: 'Helix Nebula / NGC 7293',
    catalog: 'NGC 7293',
    categoryGroup: 'nebula',
    constellation: 'Aquarius',
    ra: 22.4939,
    dec: -20.8372,
    magnitude: 7.6,
    sizeArcmin: 25,
    recommendedFocal: '300mm - 600mm',
    description: 'Closest planetary nebula to Earth, often called the Eye of God.',
  },
  {
    name: 'Veil Nebula / NGC 6960',
    catalog: 'NGC 6960',
    categoryGroup: 'nebula',
    constellation: 'Cygnus',
    ra: 20.7583,
    dec: 30.7167,
    magnitude: 7.0,
    sizeArcmin: 180,
    recommendedFocal: '135mm - 300mm',
    description: 'Supernova remnant complex in Cygnus containing Witches Broom and Western Veil.',
  },
  {
    name: 'Eagle Nebula / M16',
    catalog: 'M16',
    categoryGroup: 'nebula',
    constellation: 'Serpens',
    ra: 18.3133,
    dec: -13.7833,
    magnitude: 6.0,
    sizeArcmin: 70,
    recommendedFocal: '200mm - 500mm',
    description: 'Active star-forming HII region housing the famed Pillars of Creation.',
  },
  {
    name: 'Lagoon Nebula / M8',
    catalog: 'M8',
    categoryGroup: 'nebula',
    constellation: 'Sagittarius',
    ra: 18.0603,
    dec: -24.3867,
    magnitude: 6.0,
    sizeArcmin: 90,
    recommendedFocal: '135mm - 300mm',
    description: 'Giant interstellar cloud and bright emission nebula in Sagittarius.',
  },
  {
    name: 'Trifid Nebula / M20',
    catalog: 'M20',
    categoryGroup: 'nebula',
    constellation: 'Sagittarius',
    ra: 18.0433,
    dec: -23.0300,
    magnitude: 6.3,
    sizeArcmin: 28,
    recommendedFocal: '200mm - 500mm',
    description: 'Rare combination of emission nebula, reflection nebula, and dark dust lanes.',
  },
  {
    name: 'Crab Nebula / M1',
    catalog: 'M1',
    categoryGroup: 'nebula',
    constellation: 'Taurus',
    ra: 5.5756,
    dec: 22.0144,
    magnitude: 8.4,
    sizeArcmin: 6,
    recommendedFocal: '400mm - 1000mm',
    description: 'Supernova remnant from the historical supernova observed in 1054 AD.',
  },
  {
    name: 'Dumbbell Nebula / M27',
    catalog: 'M27',
    categoryGroup: 'nebula',
    constellation: 'Vulpecula',
    ra: 19.9933,
    dec: 22.7211,
    magnitude: 7.5,
    sizeArcmin: 8,
    recommendedFocal: '300mm - 800mm',
    description: 'First planetary nebula ever discovered, bright apple-core shape in Vulpecula.',
  },
  {
    name: 'Ring Nebula / M57',
    catalog: 'M57',
    categoryGroup: 'nebula',
    constellation: 'Lyra',
    ra: 18.8933,
    dec: 33.0292,
    magnitude: 8.8,
    sizeArcmin: 1.4,
    recommendedFocal: '500mm - 1200mm',
    description: 'Classic smoke-ring planetary nebula illuminated by hot central white dwarf.',
  },
  {
    name: 'Carina Nebula / NGC 3372',
    catalog: 'NGC 3372',
    categoryGroup: 'nebula',
    constellation: 'Carina',
    ra: 10.7500,
    dec: -59.8667,
    magnitude: 3.0,
    sizeArcmin: 120,
    recommendedFocal: '85mm - 300mm',
    description: 'Colossal southern emission complex housing luminous hypergiant Eta Carinae.',
  },
  {
    name: 'Milky Way Galactic Core',
    catalog: 'Sgr A*',
    categoryGroup: 'widefield',
    constellation: 'Sagittarius',
    ra: 17.7611,
    dec: -29.0078,
    magnitude: 1.0,
    sizeArcmin: 360,
    recommendedFocal: '14mm - 50mm',
    description: 'Supermassive black hole Sgr A* region and radiant star clouds of Sagittarius.',
  },
];

interface CategoryOption {
  readonly id: TargetCategoryFilter;
  readonly label: string;
}

const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { id: 'all', label: 'All Targets' },
  { id: 'widefield', label: 'Wide-Field Milky Way' },
  { id: 'nebula', label: 'Nebulae' },
  { id: 'galaxy', label: 'Galaxies' },
  { id: 'cluster', label: 'Star Clusters' },
];

interface TargetOpsTabProps {
  location: ResolvedSite;
  selectedNightKey?: string;
}

function loadCustomTargets(): AstroTargetItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('chroma_nocta_custom_targets_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: AstroTargetItem[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.ra === 'number' &&
        typeof item.dec === 'number' &&
        typeof item.categoryGroup === 'string'
      ) {
        const catGroup =
          item.categoryGroup === 'widefield' ||
          item.categoryGroup === 'nebula' ||
          item.categoryGroup === 'galaxy' ||
          item.categoryGroup === 'cluster'
            ? item.categoryGroup
            : 'nebula';
        valid.push({
          id: item.id,
          name: item.name,
          catalog: typeof item.catalog === 'string' ? item.catalog : 'Custom',
          type: typeof item.type === 'string' ? item.type : 'Custom Target',
          ra: item.ra,
          dec: item.dec,
          magnitude: typeof item.magnitude === 'number' ? item.magnitude : 6.0,
          sizeArcmin: typeof item.sizeArcmin === 'number' ? item.sizeArcmin : 30,
          constellation: typeof item.constellation === 'string' ? item.constellation : 'Custom',
          color: typeof item.color === 'string' ? item.color : '#38bdf8',
          secondaryColor: typeof item.secondaryColor === 'string' ? item.secondaryColor : undefined,
          recommendedFocal: typeof item.recommendedFocal === 'string' ? item.recommendedFocal : '50mm - 200mm',
          description: typeof item.description === 'string' ? item.description : 'Custom user target.',
          categoryGroup: catGroup,
          isCustom: true,
        });
      }
    }
    return valid;
  } catch {
    return [];
  }
}

function saveCustomTargets(targets: readonly AstroTargetItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('chroma_nocta_custom_targets_v1', JSON.stringify(targets));
  } catch {}
}

function playMeridianBeep(): void {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return;
  }
  try {
    const ctx = new window.AudioContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.15);
    gain2.gain.setValueAtTime(0.15, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.32);
  } catch {}
}

export const TargetOpsTab: React.FC<TargetOpsTabProps> = ({
  location,
  selectedNightKey,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<TargetCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minAltitudeDeg, setMinAltitudeDeg] = useState<number>(30);
  const [showAllTargets, setShowAllTargets] = useState<boolean>(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('mw-core');
  const [alarmLeadMinutes, setAlarmLeadMinutes] = useState<number>(20);
  const [audioAlarmEnabled, setAudioAlarmEnabled] = useState<boolean>(false);
  const [customTargets, setCustomTargets] = useState<AstroTargetItem[]>(() => loadCustomTargets());
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isTerrainModalOpen, setIsTerrainModalOpen] = useState<boolean>(false);
  const [scrubberIndex, setScrubberIndex] = useState<number | null>(null);
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);

  // New Custom Target Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'widefield' | 'nebula' | 'galaxy' | 'cluster'>('nebula');
  const [newRa, setNewRa] = useState('5.59');
  const [newDec, setNewDec] = useState('-5.39');
  const [newConstellation, setNewConstellation] = useState('Orion');
  const [newFocal, setNewFocal] = useState('135mm - 300mm');
  const [newMag, setNewMag] = useState('5.0');
  const [newSize, setNewSize] = useState('60');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [presetSearchQuery, setPresetSearchQuery] = useState<string>('');

  const filteredPresetSuggestions = useMemo(() => {
    const q = (presetSearchQuery || newName).trim().toLowerCase();
    if (q.length === 0) return [];
    return PRESET_SEARCH_DICTIONARY.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.constellation.toLowerCase().includes(q) ||
        item.catalog.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [presetSearchQuery, newName]);

  const detailSectionRef = useRef<HTMLDivElement>(null);

  const [liveClockMs, setLiveClockMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClockMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const targetNightKey =
    selectedNightKey && selectedNightKey.length > 0
      ? selectedNightKey
      : siteDateKey(Date.now(), location.timeZone);

  const nightEphemeris = useMemo(() => {
    return calculateNightEphemeris(
      targetNightKey,
      location.latitude,
      location.longitude,
      location.elevation,
      location.timeZone,
      location.horizonProfile
    );
  }, [
    targetNightKey,
    location.latitude,
    location.longitude,
    location.elevation,
    location.timeZone,
    location.horizonProfile,
  ]);

  const todayKey = siteDateKey(liveClockMs, location.timeZone);
  const isViewingToday = !selectedNightKey || selectedNightKey === todayKey;
  const activeReferenceDate = useMemo(() => {
    if (isViewingToday) {
      return new Date(liveClockMs);
    }
    if (nightEphemeris.astroDusk !== null) {
      return nightEphemeris.astroDusk;
    }
    return new Date(nightEphemeris.date.getTime() + 20 * 3600 * 1000);
  }, [isViewingToday, liveClockMs, nightEphemeris]);

  const hasTerrainMask = Boolean(
    location.horizonProfile && location.horizonProfile.some((v) => v > 0)
  );

  const allAvailableTargets = useMemo(() => {
    return getAllTargets(customTargets);
  }, [customTargets]);

  const filteredTargets = useMemo(() => {
    return filterTargets(allAvailableTargets, categoryFilter, searchQuery);
  }, [allAvailableTargets, categoryFilter, searchQuery]);

  const analyzedTargets = useMemo(() => {
    const list: ComprehensiveTargetAnalysis[] = [];
    for (const target of filteredTargets) {
      list.push(
        analyzeTargetForNight(
          target,
          nightEphemeris,
          location.latitude,
          location.longitude,
          location.timeZone,
          minAltitudeDeg,
          activeReferenceDate,
          location.horizonProfile,
          alarmLeadMinutes
        )
      );
    }
    list.sort((a, b) => b.overallScore - a.overallScore);
    return list;
  }, [
    filteredTargets,
    nightEphemeris,
    location.latitude,
    location.longitude,
    location.timeZone,
    minAltitudeDeg,
    activeReferenceDate,
    location.horizonProfile,
    alarmLeadMinutes,
  ]);

  const displayedTargets = useMemo(() => {
    if (showAllTargets) {
      return analyzedTargets;
    }
    return analyzedTargets.slice(0, 5);
  }, [analyzedTargets, showAllTargets]);

  // Find active target analysis
  const activeAnalysis = useMemo(() => {
    let found = analyzedTargets.find((a) => a.target.id === selectedTargetId);
    if (!found && analyzedTargets.length > 0) {
      found = analyzedTargets[0];
    }
    if (!found) {
      const fallbackTarget = allAvailableTargets[0];
      return analyzeTargetForNight(
        fallbackTarget,
        nightEphemeris,
        location.latitude,
        location.longitude,
        location.timeZone,
        minAltitudeDeg,
        activeReferenceDate,
        location.horizonProfile,
        alarmLeadMinutes
      );
    }
    return found;
  }, [
    analyzedTargets,
    selectedTargetId,
    allAvailableTargets,
    nightEphemeris,
    location.latitude,
    location.longitude,
    location.timeZone,
    minAltitudeDeg,
    activeReferenceDate,
    location.horizonProfile,
    alarmLeadMinutes,
  ]);

  // Automatic Web Audio Alarm when in flip window
  const lastAlarmFiredRef = useRef<number>(0);
  useEffect(() => {
    if (!audioAlarmEnabled) return;
    if (activeAnalysis.meridian.inFlipWindow) {
      const currentEpochMs = Date.now();
      if (currentEpochMs - lastAlarmFiredRef.current > 60000) {
        lastAlarmFiredRef.current = currentEpochMs;
        playMeridianBeep();
      }
    }
  }, [audioAlarmEnabled, activeAnalysis.meridian.inFlipWindow]);

  const handleSelectTarget = (targetId: string) => {
    setSelectedTargetId(targetId);
    setScrubberIndex(null);
    if (detailSectionRef.current) {
      detailSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSaveCustomTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (cleanName.length === 0) {
      setFormError('Target name is required.');
      return;
    }
    const raNum = parseFloat(newRa);
    const decNum = parseFloat(newDec);
    if (isNaN(raNum) || raNum < 0 || raNum > 24) {
      setFormError('RA must be a valid hour number between 0 and 24.');
      return;
    }
    if (isNaN(decNum) || decNum < -90 || decNum > 90) {
      setFormError('Dec must be between -90° and +90°.');
      return;
    }

    const newTarget: AstroTargetItem = {
      id: `custom-${Date.now()}`,
      name: cleanName,
      catalog: 'Custom Catalog',
      type: `${newCategory.charAt(0).toUpperCase() + newCategory.slice(1)} Target`,
      ra: raNum,
      dec: decNum,
      magnitude: isNaN(parseFloat(newMag)) ? 5.0 : parseFloat(newMag),
      sizeArcmin: isNaN(parseFloat(newSize)) ? 60 : parseFloat(newSize),
      constellation: newConstellation.trim().length > 0 ? newConstellation.trim() : 'Custom',
      color: '#38bdf8',
      recommendedFocal: newFocal.trim().length > 0 ? newFocal.trim() : '135mm - 300mm',
      description: newDescription.trim().length > 0 ? newDescription.trim() : 'Custom user target.',
      categoryGroup: newCategory,
      isCustom: true,
    };

    const nextTargets = [newTarget, ...customTargets];
    setCustomTargets(nextTargets);
    saveCustomTargets(nextTargets);
    setSelectedTargetId(newTarget.id);
    setIsAddModalOpen(false);
    setFormError(null);
    setNewName('');
    setNewDescription('');
  };

  const handleDeleteCustomTarget = (targetId: string) => {
    const nextTargets = customTargets.filter((t) => t.id !== targetId);
    setCustomTargets(nextTargets);
    saveCustomTargets(nextTargets);
    if (selectedTargetId === targetId) {
      setSelectedTargetId('mw-core');
    }
  };

  const activePoints = activeAnalysis.visibility.points;

  const scrubData = useMemo(() => {
    if (scrubRatio === null || activePoints.length === 0) return null;
    const firstPt = activePoints[0];
    const lastPt = activePoints[activePoints.length - 1];
    if (!firstPt || !lastPt) return null;
    const startMs = firstPt.timeMs;
    const endMs = lastPt.timeMs;
    const currentMs = startMs + scrubRatio * (endMs - startMs);
    const currentInstant = new Date(currentMs);

    const horiz = getHorizontalCoordinates(
      currentInstant,
      activeAnalysis.target.ra,
      activeAnalysis.target.dec,
      location.latitude,
      location.longitude
    );

    const tPlus = new Date(currentMs + 5 * 60000);
    const tMinus = new Date(currentMs - 5 * 60000);
    const hPlus = getHorizontalCoordinates(tPlus, activeAnalysis.target.ra, activeAnalysis.target.dec, location.latitude, location.longitude);
    const hMinus = getHorizontalCoordinates(tMinus, activeAnalysis.target.ra, activeAnalysis.target.dec, location.latitude, location.longitude);
    const rateDegPerHr = Math.round(((hPlus.altitude - hMinus.altitude) * 6) * 10) / 10;
    const azRounded = Math.round(((horiz.azimuth % 360) + 360) % 360) % 360;
    const azCompass = degToCompass(azRounded);
    const altRounded = Math.round(horiz.altitude * 10) / 10;
    const timeLabel = formatSiteTimeHM(currentInstant, location.timeZone);

    const x = 35 + scrubRatio * 555;
    const clampedAlt = Math.max(-90, Math.min(90, horiz.altitude));
    const y = 170 - (clampedAlt / 90) * 140;

    const approxIdx = Math.max(0, Math.min(activePoints.length - 1, Math.round(scrubRatio * (activePoints.length - 1))));
    const nearestPt = activePoints[approxIdx];
    const isDark = nearestPt ? nearestPt.isDark : false;
    const terrainAltitude = nearestPt ? nearestPt.terrainAltitude : 0;
    const isObservable = isDark && (altRounded >= minAltitudeDeg) && (altRounded >= terrainAltitude);

    return {
      x,
      y,
      timeLabel,
      altitude: altRounded,
      azimuth: azRounded,
      azCompass,
      rate: rateDegPerHr,
      isDark,
      terrainAltitude,
      isObservable,
    };
  }, [scrubRatio, activePoints, activeAnalysis.target, location.latitude, location.longitude, location.timeZone, minAltitudeDeg]);

  const midPoint = activePoints.length > 0 ? activePoints[Math.floor(activePoints.length / 2)] ?? null : null;

  const activeTelemetry = useMemo(() => {
    if (scrubData) return scrubData;
    if (!midPoint) return null;
    const midIdx = Math.floor(activePoints.length / 2);
    const p0 = activePoints[Math.max(0, midIdx - 1)];
    const p1 = activePoints[Math.min(activePoints.length - 1, midIdx + 1)];
    const dt = p0 && p1 && p1.timeMs > p0.timeMs ? (p1.timeMs - p0.timeMs) / (3600 * 1000) : 1;
    const r = p0 && p1 && dt > 0 ? Math.round(((p1.altitude - p0.altitude) / dt) * 10) / 10 : 0;
    return {
      x: 35 + 0.5 * 555,
      y: 170 - (Math.max(-90, Math.min(90, midPoint.altitude)) / 90) * 140,
      timeLabel: midPoint.timeLabel,
      altitude: midPoint.altitude,
      azimuth: midPoint.azimuth,
      azCompass: degToCompass(midPoint.azimuth),
      rate: r,
      isDark: midPoint.isDark,
      terrainAltitude: midPoint.terrainAltitude,
      isObservable: midPoint.isObservable,
    };
  }, [scrubData, midPoint, activePoints]);

  return (
    <div className="space-y-4 pb-28 text-[var(--theme-text)] max-w-6xl mx-auto">
      {/* SECTION 1: HEADER & CONTROLS */}
      <section className="bg-[var(--theme-card)] border border-theme rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-theme/40 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 bg-[var(--theme-primary)]/15 text-theme-primary border border-theme rounded-xl flex items-center justify-center shrink-0 glow-primary-subtle">
              <Crosshair className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h1 className="typo-section text-theme-primary flex items-center gap-2 truncate">
                TARGET OPS & CELESTIAL TARGETING
              </h1>
              <p className="text-[11px] font-mono text-theme-muted truncate mt-0.5">
                {formatSiteDateLabel(targetNightKey)} • {location.name} ({location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°, {location.elevation}m)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setIsTerrainModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition border active:scale-95 cursor-pointer ${
                hasTerrainMask
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 border-theme text-theme-accent'
              }`}
              title="Configure 8-direction topographic horizon and obstacle mask"
            >
              <Mountain className="w-3.5 h-3.5 text-theme-primary" />
              <span>{hasTerrainMask ? '8-Dir Terrain Mask: Active' : 'Configure 8-Dir Terrain Mask'}</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-extrabold bg-[var(--theme-primary)] hover:opacity-90 text-black transition glow-primary-subtle active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Target</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Altitude Threshold Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_OPTIONS.map((cat) => {
              const isActive = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer active:scale-95 border ${
                    isActive
                      ? 'bg-[var(--theme-primary)] text-black border-[var(--theme-accent)] glow-primary-subtle'
                      : 'bg-black/45 border-white/10 text-slate-300 hover:bg-white/10 hover:border-theme hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Continuous 0°-50° Min Altitude Slider */}
          <div className="flex flex-wrap items-center gap-2 bg-black/55 p-2 rounded-xl border border-theme/50 self-start md:self-auto font-mono">
            <span className="text-[11px] font-bold text-theme-muted px-1 flex items-center gap-1 shrink-0">
              <Sliders className="w-3.5 h-3.5 text-theme-primary" />
              Min Alt:
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={minAltitudeDeg}
              onChange={(e) => setMinAltitudeDeg(Number(e.target.value))}
              className="w-24 sm:w-32 accent-[var(--theme-primary)] cursor-pointer"
              aria-label="Minimum Altitude Slider"
            />
            <span className="font-mono text-xs font-extrabold text-theme-accent min-w-[38px]">
              +{minAltitudeDeg}°
            </span>
            <div className="flex items-center gap-1 pl-1.5 border-l border-white/10">
              {[15, 25, 35].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => setMinAltitudeDeg(deg)}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg transition cursor-pointer ${
                    minAltitudeDeg === deg
                      ? 'bg-[var(--theme-primary)] text-black'
                      : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/15'
                  }`}
                >
                  +{deg}°
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-theme-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog by name, constellation (e.g. Orion, Cygnus, M31)..."
            className="w-full bg-black/55 border border-white/10 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-theme transition"
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* SECTION 2: TOP TARGETS WITH MINI SPARKLINES */}
      <section className="bg-[var(--theme-card)] border border-theme rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between border-b border-theme/40 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-theme-primary shrink-0" />
            <h2 className="typo-section text-theme-primary">
              {showAllTargets ? `ALL TARGETS (${analyzedTargets.length})` : 'TOP 5 TONIGHT — RECOMMENDED OPPORTUNITIES'}
            </h2>
          </div>
          <button
            onClick={() => setShowAllTargets(!showAllTargets)}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-theme-accent hover:opacity-90 transition py-1 px-2.5 rounded-xl border border-theme bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 cursor-pointer active:scale-95"
          >
            {showAllTargets ? (
              <>
                <NoctaTriangle direction="up" className="w-3.5 h-3.5 text-theme-primary" />
                <span>Show Top 5 Only</span>
              </>
            ) : (
              <>
                <NoctaTriangle direction="down" className="w-3.5 h-3.5 text-theme-primary" />
                <span>Show All ({analyzedTargets.length})</span>
              </>
            )}
          </button>
        </div>

        {displayedTargets.length === 0 ? (
          <div className="text-center py-10 bg-black/40 rounded-xl border border-white/10 font-mono">
            <p className="text-xs sm:text-sm text-theme-muted">No targets found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedTargets.map((analysis) => {
              const { target, visibility, lunar, meridian, overallScore } = analysis;
              const isSelected = target.id === selectedTargetId;

              // Build mini sparkline points (110x34)
              const pts = visibility.points;
              const sparklinePts = pts.map((p, i) => {
                const x = pts.length > 1 ? (i / (pts.length - 1)) * 106 + 2 : 55;
                const clampedAlt = Math.max(0, Math.min(90, p.altitude));
                const y = 32 - (clampedAlt / 90) * 28;
                return { x, y };
              });
              const sparklinePath = getSmoothSplinePath(sparklinePts);
              const threshY = 32 - (minAltitudeDeg / 90) * 28;

              return (
                <div
                  key={target.id}
                  onClick={() => handleSelectTarget(target.id)}
                  className={`cursor-pointer rounded-xl p-3.5 transition border text-left relative flex flex-col justify-between font-mono ${
                    isSelected
                      ? 'bg-[var(--theme-primary)]/15 border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/50 glow-primary-subtle'
                      : 'bg-black/45 border-white/10 hover:border-theme hover:bg-white/5'
                  }`}
                >
                  <div>
                    {/* Header: Score & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono tracking-wider uppercase text-theme-muted font-semibold block truncate">
                          {target.catalog} • {target.constellation}
                        </span>
                        <h3 className="text-xs sm:text-sm font-extrabold text-white truncate flex items-center gap-1.5 mt-0.5">
                          {target.name}
                          {target.isCustom && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--theme-primary)]/20 text-theme-accent border border-theme">
                              CUSTOM
                            </span>
                          )}
                        </h3>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-lg text-xs font-extrabold tracking-tight shrink-0 border ${
                          overallScore >= 80
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : overallScore >= 50
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        {overallScore} / 100
                      </div>
                    </div>

                    {/* Telemetry Row */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-white/10 text-[11px]">
                      <div>
                        <span className="text-theme-muted block text-[9px] uppercase">Window</span>
                        <span className="font-bold text-emerald-400">{visibility.observableHours}h Dark</span>
                      </div>
                      <div>
                        <span className="text-theme-muted block text-[9px] uppercase">Peak Alt</span>
                        <span className="font-bold text-white">
                          {visibility.peakAltitude}° @ {visibility.peakTimeLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block text-[9px] uppercase">Moon Sep</span>
                        <span
                          className={`font-bold ${
                            lunar.warningLevel === 'severe'
                              ? 'text-rose-400'
                              : lunar.warningLevel === 'moderate'
                                ? 'text-amber-400'
                                : 'text-theme-accent'
                          }`}
                        >
                          {lunar.separationDeg}°
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sparkline & Recommended Focal Footer */}
                  <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-theme-muted font-mono truncate">
                      Lens: <b className="text-slate-200">{target.recommendedFocal}</b>
                    </span>
                    <svg
                      width="110"
                      height="34"
                      viewBox="0 0 110 34"
                      className="shrink-0 bg-[#050b18] rounded-lg border border-theme/50 glow-primary-subtle"
                    >
                      <defs>
                        <linearGradient id={`sparkGlow-${target.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={overallScore >= 70 ? '#34d399' : '#38bdf8'} stopOpacity="0.42" />
                          <stop offset="100%" stopColor={overallScore >= 70 ? '#34d399' : '#38bdf8'} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Sparkline area glow */}
                      {sparklinePts.length > 1 && (
                        <polygon
                          points={`2,32 ${sparklinePts.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')} 108,32`}
                          fill={`url(#sparkGlow-${target.id})`}
                        />
                      )}
                      {/* Threshold line */}
                      <line
                        x1="0"
                        y1={threshY}
                        x2="110"
                        y2={threshY}
                        stroke="rgba(245, 158, 11, 0.55)"
                        strokeWidth="0.8"
                        strokeDasharray="2,2"
                      />
                      {/* Horizon line */}
                      <line x1="0" y1="32" x2="110" y2="32" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="0.8" />
                      {/* Elevation path */}
                      <path
                        d={sparklinePath}
                        fill="none"
                        stroke={overallScore >= 70 ? '#34d399' : '#38bdf8'}
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {meridian.inFlipWindow && (
                    <div className="mt-2 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      GEM Flip Window Active
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: DETAILED CELESTIAL ALTITUDE & NET OBSERVABLE CURVE */}
      <section
        ref={detailSectionRef}
        className="bg-[var(--theme-card)] border border-theme rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 font-mono"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-theme/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-[var(--theme-primary)]/15 text-theme-accent border border-theme">
                {activeAnalysis.target.catalog}
              </span>
              <span className="text-[11px] text-theme-muted font-mono">
                RA: {activeAnalysis.target.ra.toFixed(2)}h • Dec: {activeAnalysis.target.dec.toFixed(2)}° • Mag {activeAnalysis.target.magnitude}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
              {activeAnalysis.target.name}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-3xl font-sans">
              {activeAnalysis.target.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeAnalysis.target.isCustom && (
              <button
                onClick={() => handleDeleteCustomTarget(activeAnalysis.target.id)}
                className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Delete this custom target"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
            <div className="bg-black/55 px-3.5 py-2.5 rounded-xl border border-theme glow-primary-subtle text-right">
              <span className="text-[10px] font-mono uppercase text-theme-muted block">Overall Tactical Score</span>
              <span className="text-lg font-black text-theme-primary">
                {activeAnalysis.overallScore} / 100
              </span>
            </div>
          </div>
        </div>

        {/* Tactical Summary Banner */}
        <div className="p-3 rounded-xl bg-black/45 border border-theme/50 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-theme-primary shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-theme-accent block">Imaging Session Tactical Briefing:</span>
            <p className="text-xs text-slate-200 mt-0.5">{activeAnalysis.tacticalSummary}</p>
          </div>
        </div>

        {/* Large Interactive SVG Chart with Curve-Under-Glow */}
        <div className="relative bg-black/65 rounded-2xl p-3 sm:p-4 border border-theme/60 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 mb-2.5 gap-2">
            <span className="typo-section text-theme-primary flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-theme-primary" />
              <span>Night Altitude Profile & Imaging Window</span>
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--theme-primary)] inline-block rounded-full" />
                <span>Altitude</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />
                <span>Min-Alt (+{minAltitudeDeg}°)</span>
              </span>
              {hasTerrainMask && (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                  <span>Mountain Mask</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-emerald-500/35 border border-emerald-400/50 inline-block rounded-xs" />
                <span>Net Dark Window</span>
              </span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="relative w-full h-[300px] sm:h-[340px]">
            <svg
              viewBox="0 0 600 340"
              preserveAspectRatio="none"
              className="w-full h-full select-none cursor-crosshair block"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const xRel = Math.max(0, Math.min(1, (e.clientX - rect.left - (35 * rect.width) / 600) / ((555 * rect.width) / 600)));
                setScrubRatio(xRel);
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const xRel = Math.max(0, Math.min(1, (touch.clientX - rect.left - (35 * rect.width) / 600) / ((555 * rect.width) / 600)));
                setScrubRatio(xRel);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const xRel = Math.max(0, Math.min(1, (touch.clientX - rect.left - (35 * rect.width) / 600) / ((555 * rect.width) / 600)));
                setScrubRatio(xRel);
              }}
              onMouseLeave={() => setScrubRatio(null)}
            >
              <defs>
                <linearGradient id="observableGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.52" />
                  <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="targetUnderGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="#6366f1" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="mountainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                </linearGradient>
                <filter id="targetCurveGlow" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#38bdf8" floodOpacity="0.8" />
                  <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor="#6366f1" floodOpacity="0.45" />
                </filter>
              </defs>

              {/* Background Zones: Above 0° Sky (#081126) and Below 0° Sub-Horizon (#02050d) */}
              <rect x="35" y="30" width="555" height="140" fill="#081126" />
              <rect x="35" y="170" width="555" height="140" fill="#02050d" />

              {/* Astronomical Night Corridor Shading & Boundary Guides */}
              {(() => {
                const darkIndices: number[] = [];
                activePoints.forEach((p, idx) => {
                  if (p.isDark) darkIndices.push(idx);
                });
                if (darkIndices.length < 2) return null;
                const firstIdx = darkIndices[0] ?? 0;
                const lastIdx = darkIndices[darkIndices.length - 1] ?? 0;
                const xStart = 35 + (firstIdx / Math.max(1, activePoints.length - 1)) * 555;
                const xEnd = 35 + (lastIdx / Math.max(1, activePoints.length - 1)) * 555;
                return (
                  <g key="astro-dark-corridor">
                    <rect
                      x={xStart}
                      y={30}
                      width={Math.max(1, xEnd - xStart)}
                      height={140}
                      fill="rgba(2, 6, 23, 0.45)"
                    />
                    <line x1={xStart} y1={30} x2={xStart} y2={310} stroke="rgba(129, 140, 248, 0.28)" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1={xEnd} y1={30} x2={xEnd} y2={310} stroke="rgba(129, 140, 248, 0.28)" strokeWidth="1" strokeDasharray="3,3" />
                    <text x={xStart + 4} y={42} fill="rgba(165, 180, 252, 0.75)" fontSize="8" fontFamily="monospace">
                      Astro Dusk
                    </text>
                    <text x={xEnd - 4} y={42} fill="rgba(165, 180, 252, 0.75)" fontSize="8" fontFamily="monospace" textAnchor="end">
                      Astro Dawn
                    </text>
                  </g>
                );
              })()}

              {/* Horizontal Altitude Gridlines (+90°, +60°, +30°, 0° Horizon, -30°, -60°, -90°) */}
              {[90, 60, 30, 0, -30, -60, -90].map((deg) => {
                const y = 170 - (deg / 90) * 140;
                if (deg === 0) {
                  return (
                    <g key={deg}>
                      <line x1="35" y1="170" x2="590" y2="170" stroke="rgba(226, 232, 240, 0.8)" strokeWidth="1.3" />
                      <text x="29" y={173} fill="rgba(255, 255, 255, 0.9)" fontSize="9" textAnchor="end" fontFamily="monospace" fontWeight="bold">
                        0°
                      </text>
                      <text x="42" y="164" fill="rgba(255, 255, 255, 0.8)" fontSize="9" fontFamily="monospace" fontWeight="bold">
                        Horizon
                      </text>
                    </g>
                  );
                }
                return (
                  <g key={deg}>
                    <line x1="35" y1={y} x2="590" y2={y} stroke="rgba(148, 163, 184, 0.14)" strokeWidth="0.7" />
                    <text x="29" y={y + 3} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
                      {deg > 0 ? `+${deg}°` : `${deg}°`}
                    </text>
                  </g>
                );
              })}

              {/* Full-Curve Ambient Under-Glow (Above 0° Horizon) */}
              {(() => {
                if (activePoints.length < 2) return null;
                const pts = activePoints.map((p, i) => {
                  const x = 35 + (i / Math.max(1, activePoints.length - 1)) * 555;
                  const clampedAlt = Math.max(0, Math.min(90, p.altitude));
                  const y = 170 - (clampedAlt / 90) * 140;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                });
                const poly = `35,170 ${pts.join(' ')} 590,170`;
                return <polygon points={poly} fill="url(#targetUnderGlow)" />;
              })()}

              {/* Observable Net Imaging Window Full-Dome Glow (Down to 0° Horizon y=170) */}
              {(() => {
                const polys: string[] = [];
                let currentChunk: { x: number; y: number }[] = [];
                activePoints.forEach((p, i) => {
                  const x = 35 + (i / Math.max(1, activePoints.length - 1)) * 555;
                  const clampedAlt = Math.max(-90, Math.min(90, p.altitude));
                  const y = 170 - (clampedAlt / 90) * 140;
                  if (p.isObservable) {
                    currentChunk.push({ x, y });
                  } else {
                    if (currentChunk.length > 1) {
                      const top = currentChunk.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
                      polys.push(`${currentChunk[0].x.toFixed(1)},170 ${top} ${currentChunk[currentChunk.length - 1].x.toFixed(1)},170`);
                    }
                    currentChunk = [];
                  }
                });
                if (currentChunk.length > 1) {
                  const top = currentChunk.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
                  polys.push(`${currentChunk[0].x.toFixed(1)},170 ${top} ${currentChunk[currentChunk.length - 1].x.toFixed(1)},170`);
                }
                return polys.map((polyStr, idx) => (
                  <polygon key={idx} points={polyStr} fill="url(#observableGlow)" />
                ));
              })()}

              {/* Mountain Terrain Obstruction Polygon */}
              {hasTerrainMask && (() => {
                const terrainPts = activePoints.map((p, i) => {
                  const x = 35 + (i / Math.max(1, activePoints.length - 1)) * 555;
                  const clamped = Math.max(-90, Math.min(90, p.terrainAltitude));
                  const y = 170 - (clamped / 90) * 140;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                });
                const poly = `35,170 ${terrainPts.join(' ')} 590,170`;
                return (
                  <g>
                    <polygon points={poly} fill="url(#mountainGrad)" />
                    <polyline points={terrainPts.join(' ')} fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3,3" />
                  </g>
                );
              })()}

              {/* Live Min-Alt Threshold Line */}
              {(() => {
                const threshY = 170 - (minAltitudeDeg / 90) * 140;
                return (
                  <g key="min-alt-threshold">
                    <line
                      x1="35"
                      y1={threshY}
                      x2="590"
                      y2={threshY}
                      stroke="#f59e0b"
                      strokeWidth="1.2"
                      strokeDasharray="4,4"
                    />
                    <text
                      x="586"
                      y={Math.max(40, threshY - 5)}
                      fill="#fbbf24"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      Min-Alt: +{minAltitudeDeg}°
                    </text>
                  </g>
                );
              })()}

              {/* Main Target Altitude Curve (Smooth Spline with Luminous Neon Glow) */}
              {(() => {
                const splinePts = activePoints.map((p, i) => {
                  const x = 35 + (i / Math.max(1, activePoints.length - 1)) * 555;
                  const clampedAlt = Math.max(-90, Math.min(90, p.altitude));
                  const y = 170 - (clampedAlt / 90) * 140;
                  return { x, y };
                });
                const splinePath = getSmoothSplinePath(splinePts);
                return (
                  <path
                    d={splinePath}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#targetCurveGlow)"
                  />
                );
              })()}

              {/* Peak marker (Astronomical Dark Window Only, Edge-Clamped) */}
              {(() => {
                const darkPointsWithIndex = activePoints
                  .map((p, i) => ({ point: p, index: i }))
                  .filter((item) => item.point.isDark);
                if (darkPointsWithIndex.length === 0) return null;

                let peakItem = darkPointsWithIndex[0];
                if (!peakItem) return null;
                for (const item of darkPointsWithIndex) {
                  if (item.point.altitude > peakItem.point.altitude) {
                    peakItem = item;
                  }
                }
                const maxAlt = peakItem.point.altitude;
                if (maxAlt <= 0) return null;

                const x = 35 + (peakItem.index / Math.max(1, activePoints.length - 1)) * 555;
                const clampedX = Math.max(68, Math.min(556, x));
                const clamped = Math.max(-90, Math.min(90, maxAlt));
                const y = 170 - (clamped / 90) * 140;
                const labelY = y < 48 ? y + 15 : y - 8;
                return (
                  <g key="peak-marker-dark">
                    <circle cx={x} cy={y} r="4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.6" filter="url(#targetCurveGlow)" />
                    <text x={clampedX} y={labelY} fill="#ffffff" fontSize="9.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      Peak {maxAlt}°
                    </text>
                  </g>
                );
              })()}

              {/* Continuous Scrubber vertical line & Floating Badge */}
              {scrubData && (
                <g key="scrub-indicator">
                  <line x1={scrubData.x} y1="30" x2={scrubData.x} y2="310" stroke="#a78bfa" strokeWidth="1.3" strokeDasharray="3,3" />
                  <circle cx={scrubData.x} cy={scrubData.y} r="5" fill="#a78bfa" stroke="#ffffff" strokeWidth="1.5" />
                  <rect
                    x={Math.max(38, Math.min(502, scrubData.x - 42))}
                    y={scrubData.y < 54 ? scrubData.y + 8 : scrubData.y - 24}
                    width="84"
                    height="17"
                    rx="4"
                    fill="rgba(2, 6, 23, 0.92)"
                    stroke="#a78bfa"
                    strokeWidth="1"
                  />
                  <text
                    x={Math.max(38, Math.min(502, scrubData.x - 42)) + 42}
                    y={(scrubData.y < 54 ? scrubData.y + 8 : scrubData.y - 24) + 11.5}
                    fill="#ffffff"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {scrubData.timeLabel} • {scrubData.altitude > 0 ? `+${scrubData.altitude}°` : `${scrubData.altitude}°`}
                  </text>
                </g>
              )}

              {/* Time tick labels along X axis */}
              {activePoints.map((p, i) => {
                if (i % 3 !== 0 && i !== activePoints.length - 1) return null;
                const x = 35 + (i / (activePoints.length - 1)) * 555;
                return (
                  <text
                    key={i}
                    x={x}
                    y="328"
                    fill="#94a3b8"
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {p.timeLabel}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Interactive Scrubber Telemetry HUD */}
          {activeTelemetry && (
            <div className="mt-3 bg-black/55 border border-theme/50 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between text-xs font-mono gap-2.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-theme-primary" />
                <span className="text-white font-extrabold">{activeTelemetry.timeLabel}</span>
              </div>
              <div>
                <span className="text-theme-muted">Altitude: </span>
                <span className="text-theme-accent font-extrabold">
                  {activeTelemetry.altitude > 0 ? `+${activeTelemetry.altitude.toFixed(1)}°` : `${activeTelemetry.altitude.toFixed(1)}°`}
                </span>
              </div>
              <div>
                <span className="text-theme-muted">Azimuth: </span>
                <span className="text-white font-bold">{activeTelemetry.azimuth}° ({activeTelemetry.azCompass})</span>
              </div>
              <div>
                <span className="text-theme-muted">Rate: </span>
                <span className={`font-bold ${activeTelemetry.rate >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {activeTelemetry.rate >= 0 ? `+${activeTelemetry.rate.toFixed(1)}°/h ⇗` : `${activeTelemetry.rate.toFixed(1)}°/h ⇘`}
                </span>
              </div>
              {hasTerrainMask && (
                <div>
                  <span className="text-theme-muted">Mountain Floor: </span>
                  <span className="text-amber-300 font-bold">{activeTelemetry.terrainAltitude}°</span>
                </div>
              )}
              <div>
                <span className="text-theme-muted">Darkness: </span>
                <span className={activeTelemetry.isDark ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {activeTelemetry.isDark ? 'Astronomical Night' : 'Twilight / Daylight'}
                </span>
              </div>
              <div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    activeTelemetry.isObservable
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {activeTelemetry.isObservable ? 'SHOOTING WINDOW ACTIVE' : 'OBSTRUCTED / FAINT'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Lunar Interference & Glare Banner */}
        <div className="p-3.5 rounded-xl bg-black/45 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`p-2 rounded-xl border shrink-0 ${
                activeAnalysis.lunar.warningLevel === 'severe'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : activeAnalysis.lunar.warningLevel === 'moderate'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-theme-muted font-bold">
                  Lunar Clearance & Glare Assessment
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    activeAnalysis.lunar.warningLevel === 'severe'
                      ? 'bg-rose-500/20 text-rose-300'
                      : activeAnalysis.lunar.warningLevel === 'moderate'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {activeAnalysis.lunar.warningLevel}
                </span>
              </div>
              <p className="text-xs text-slate-200 font-medium mt-1">
                Angular Separation: <span className="font-bold text-white">{activeAnalysis.lunar.separationDeg}°</span> • Moon Illumination: <span className="font-bold text-white">{activeAnalysis.lunar.moonIllumination}% ({activeAnalysis.lunar.moonPhaseName})</span> • Moon Alt: <span className="font-bold text-white">{activeAnalysis.lunar.moonAltitude}°</span>
              </p>
              <p className="text-[11px] text-theme-muted mt-0.5">{activeAnalysis.lunar.warningNote}</p>
            </div>
          </div>

          {activeAnalysis.lunar.warningLevel !== 'optimal' && (
            <div className="sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-mono text-amber-400 block font-bold">
                Filter Recommendation
              </span>
              <span className="text-xs text-slate-300">Dual-Narrowband (SHO / Ha-OIII) or RGB Rejection</span>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: LIVE MERIDIAN FLIP WATCHDOG */}
      <section className="bg-[var(--theme-card)] border border-theme rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-theme/40">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[var(--theme-primary)]/15 border border-theme text-theme-primary flex items-center justify-center shrink-0 glow-primary-subtle">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h2 className="typo-section text-theme-primary">
                MERIDIAN FLIP WATCHDOG & PIER COLLISION GUARD
              </h2>
              <p className="text-[11px] text-theme-muted">
                German Equatorial Mount (GEM) axis tracker, countdown timer & acoustic pier clearance warning.
              </p>
            </div>
          </div>

          {/* Alarm Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/55 border border-theme/50 text-xs font-mono text-theme-accent">
              <Clock className="w-3.5 h-3.5 text-theme-primary" />
              <span>{isViewingToday ? 'Live Site' : 'Night'}: {formatSiteTimeHM(activeReferenceDate, location.timeZone)}</span>
            </div>

            <div className="flex items-center gap-1 bg-black/55 p-1 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono uppercase text-theme-muted px-2">Lead Time:</span>
              {[15, 20, 30].map((lead) => (
                <button
                  key={lead}
                  onClick={() => setAlarmLeadMinutes(lead)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    alarmLeadMinutes === lead
                      ? 'bg-[var(--theme-primary)] text-black'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {lead}m
                </button>
              ))}
            </div>

            <button
              onClick={() => setAudioAlarmEnabled(!audioAlarmEnabled)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 ${
                audioAlarmEnabled
                  ? 'bg-[var(--theme-primary)] text-black border-[var(--theme-accent)] glow-primary-subtle'
                  : 'bg-black/45 text-slate-300 border-white/10 hover:text-white hover:border-theme'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{audioAlarmEnabled ? 'Audio Alert On' : 'Audio Alert Off'}</span>
            </button>

            <button
              onClick={playMeridianBeep}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 hover:border-theme transition cursor-pointer active:scale-95"
              title="Test Web Audio API buzzer tone"
            >
              <Volume2 className="w-3.5 h-3.5 text-theme-primary" />
              <span>Test Beep</span>
            </button>
          </div>
        </div>

        {/* Meridian Flip Warning Banner */}
        {activeAnalysis.meridian.inFlipWindow && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-start gap-3 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
                MERIDIAN FLIP IMMINENT — Check cable tension & tripod pier clearance!
              </h3>
              <p className="text-xs text-rose-200 mt-1">
                Target is within the critical ±{alarmLeadMinutes} min transition zone (Δ={activeAnalysis.meridian.timeToTransitMinutes} min). Halt long-exposure guiding or allow autonomous mount meridian flip sequence.
              </p>
            </div>
          </div>
        )}

        {/* Watchdog Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-black/45 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-mono text-theme-muted block">Transit Time</span>
            <span className="text-base sm:text-lg font-black text-white mt-0.5 block">
              {activeAnalysis.meridian.transitTimeLabel}
            </span>
            <span className="text-[10px] text-slate-400">Local Site Time</span>
          </div>

          <div className="bg-black/45 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-mono text-theme-muted block">Hour Angle (HA)</span>
            <span className="text-base sm:text-lg font-black text-theme-accent mt-0.5 block">
              {activeAnalysis.meridian.hourAngleHours}h
            </span>
            <span className="text-[10px] text-slate-400">{activeAnalysis.meridian.axisSideLabel}</span>
          </div>

          <div className="bg-black/45 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-mono text-theme-muted block">Culmination Alt</span>
            <span className="text-base sm:text-lg font-black text-white mt-0.5 block">
              {activeAnalysis.meridian.transitAltitude}°
            </span>
            <span className="text-[10px] text-slate-400">Peak Zenith Proximity</span>
          </div>

          <div className="bg-black/45 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-mono text-theme-muted block">Darkness Overlap</span>
            <span
              className={`text-base sm:text-lg font-black mt-0.5 block ${
                activeAnalysis.meridian.isDuringDarkness ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {activeAnalysis.meridian.isDuringDarkness ? 'In Darkness' : 'In Twilight'}
            </span>
            <span className="text-[10px] text-slate-400">Prime SHO / LRGB</span>
          </div>
        </div>

        {/* GEM Guidance notes */}
        <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-xs text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-theme-primary shrink-0" />
            <span>Watchdog Status: {activeAnalysis.meridian.description}</span>
          </span>
          <span className="font-mono text-[11px] text-theme-muted hidden md:inline">
            Flip threshold: ±{alarmLeadMinutes}m
          </span>
        </div>
      </section>

      {/* SECTION 5: ADD CUSTOM TARGET MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Add Custom Astro Target</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomTarget} className="mt-4 space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div className="relative">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Barnard 33, Rosette, M31..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
                {filteredPresetSuggestions.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-indigo-400 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                      <span>Smart Target Autocomplete</span>
                      <span>Click to auto-fill</span>
                    </div>
                    {filteredPresetSuggestions.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setNewName(preset.name);
                          setPresetSearchQuery('');
                          setNewCategory(preset.categoryGroup);
                          setNewConstellation(preset.constellation);
                          setNewRa(preset.ra.toFixed(4));
                          setNewDec(preset.dec.toFixed(4));
                          setNewMag(preset.magnitude.toFixed(1));
                          setNewSize(String(preset.sizeArcmin));
                          setNewFocal(preset.recommendedFocal);
                          setNewDescription(preset.description);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-indigo-600/20 hover:text-white flex items-center justify-between gap-2 border-b border-slate-800/60 last:border-b-0 transition text-xs cursor-pointer"
                      >
                        <span className="font-semibold text-slate-200 truncate">{preset.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {preset.constellation} • RA {preset.ra.toFixed(2)}h
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'widefield' || v === 'nebula' || v === 'galaxy' || v === 'cluster') {
                        setNewCategory(v);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="nebula">Nebula</option>
                    <option value="galaxy">Galaxy</option>
                    <option value="cluster">Cluster</option>
                    <option value="widefield">Wide-Field Milky Way</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Constellation
                  </label>
                  <input
                    type="text"
                    value={newConstellation}
                    onChange={(e) => setNewConstellation(e.target.value)}
                    placeholder="e.g. Orion"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Right Ascension (RA Hours 0..24) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="24"
                    value={newRa}
                    onChange={(e) => setNewRa(e.target.value)}
                    placeholder="5.59"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Declination (Dec Degrees -90..+90) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="-90"
                    max="90"
                    value={newDec}
                    onChange={(e) => setNewDec(e.target.value)}
                    placeholder="-5.39"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Apparent Mag
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newMag}
                    onChange={(e) => setNewMag(e.target.value)}
                    placeholder="5.0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Size (arcmin)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    placeholder="60"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Focal Length
                  </label>
                  <input
                    type="text"
                    value={newFocal}
                    onChange={(e) => setNewFocal(e.target.value)}
                    placeholder="200mm - 600mm"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tactical Notes & Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Prime dual-narrowband target. Watch for low eastern altitude early in session."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
                >
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8-Direction Horizon & Obstacle Mask Modal */}
      <HorizonMaskModal
        isOpen={isTerrainModalOpen}
        onClose={() => setIsTerrainModalOpen(false)}
        location={location}
        onUpdateHorizon={(newProfile) => {
          const updatedLoc: ResolvedSite = {
            ...location,
            horizonProfile: newProfile,
          };
          saveStoredLocation(updatedLoc);
          window.dispatchEvent(new CustomEvent('chroma_location_changed', { detail: updatedLoc }));
        }}
      />
    </div>
  );
};
