import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, LocationData, ResolvedSite, ThemeId } from './types';
import { getStoredTheme, saveTheme } from './lib/theme';
import { getStoredLocation, saveStoredLocation } from './lib/coordinateParser';
import { resolveSite, initialNightKeyForSite, addDaysToDateKey, currentNightKey, siteDateKey, siteNoon } from './lib/siteTime';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { LocationModal } from './components/LocationModal';
import { SettingsModal } from './components/SettingsModal';
import { MiniCalendarModal } from './components/MiniCalendarModal';
import { NeedsTimeZone } from './components/NeedsTimeZone';
import { NightCalendarTab } from './components/tabs/NightCalendarTab';
import { FieldWeatherTab } from './components/tabs/FieldWeatherTab';
import { RouteTab } from './components/tabs/RouteTab';
import { TargetOpsTab } from './components/tabs/TargetOpsTab';
import { SkyVizorTab } from './components/tabs/SkyVizorTab';
import { StationBriefingModal } from './components/StationBriefingModal';

function isLocationData(val: unknown): val is LocationData {
  if (typeof val !== 'object' || val === null) return false;
  if (!('id' in val) || typeof val.id !== 'string') return false;
  if (!('name' in val) || typeof val.name !== 'string') return false;
  if (!('latitude' in val) || typeof val.latitude !== 'number') return false;
  if (!('longitude' in val) || typeof val.longitude !== 'number') return false;
  if (!('elevation' in val) || typeof val.elevation !== 'number') return false;
  if (!('horizonDip' in val) || typeof val.horizonDip !== 'number') return false;
  return true;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const initialTheme = getStoredTheme();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initialTheme);
    }
    return initialTheme;
  });
  const [location, setLocation] = useState<LocationData>(() => getStoredLocation());
  const [selectedNightKey, setSelectedNightKey] = useState<string>(() =>
    initialNightKeyForSite(location, Date.now()) || ''
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(true);
  const [isNightLock, setIsNightLock] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('chroma_night_lock_active') === 'true';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const hash = window.location.hash;
    if (hash === '#tabWeather') return 'weather';
    if (hash === '#tabRoute') return 'route';
    if (hash === '#tabTargets') return 'targets';
    if (hash === '#tabSky') return 'sky';
    return 'calendar';
  });
  const activeTabRef = useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;
  const tabScrollPositionsRef = useRef<Record<string, number>>({});
  const [visitedTabs, setVisitedTabs] = useState<Readonly<Record<ActiveTab, boolean>>>(() => ({
    calendar: activeTab === 'calendar',
    weather: activeTab === 'weather' || activeTab === 'fieldWeather',
    fieldWeather: activeTab === 'weather' || activeTab === 'fieldWeather',
    route: activeTab === 'route',
    targets: activeTab === 'targets',
    sky: activeTab === 'sky',
  }));
  const [skySelectedDate, setSkySelectedDate] = useState<Date | undefined>(undefined);
  const [inspectedWeatherSite, setInspectedWeatherSite] = useState<LocationData | null>(null);

  const resolvedSite = resolveSite(location);

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (activeTab === 'weather' || activeTab === 'fieldWeather') {
        if (prev.weather && prev.fieldWeather) return prev;
        return { ...prev, weather: true, fieldWeather: true };
      }
      if (prev[activeTab]) return prev;
      return { ...prev, [activeTab]: true };
    });
  }, [activeTab]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isNightLock) {
        document.documentElement.setAttribute('data-night-lock', 'true');
      } else {
        document.documentElement.removeAttribute('data-night-lock');
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('chroma_night_lock_active', isNightLock ? 'true' : 'false');
    }
  }, [isNightLock]);

  useEffect(() => {
    if (!isBriefingModalOpen && typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: tabScrollPositionsRef.current[activeTab] ?? 0,
          behavior: 'instant',
        });
      });
    }
  }, [activeTab, isBriefingModalOpen]);

  // Browser & mobile hardware back button popstate navigation management
  useEffect(() => {
    const handlePopState = () => {
      if (isBriefingModalOpen) {
        setIsBriefingModalOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isBriefingModalOpen]);

  const handleOpenBriefing = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ modal: 'briefing' }, '');
    }
    setIsBriefingModalOpen(true);
  };

  useEffect(() => {
    if (resolvedSite?.timeZone) {
      setSelectedNightKey(initialNightKeyForSite(resolvedSite, Date.now()) || '');
    }
  }, [resolvedSite?.timeZone]);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      let nextTab: ActiveTab | null = null;
      if (hash === '#tabCalendar') nextTab = 'calendar';
      else if (hash === '#tabWeather') nextTab = 'weather';
      else if (hash === '#tabRoute') nextTab = 'route';
      else if (hash === '#tabTargets') nextTab = 'targets';
      else if (hash === '#tabSky') nextTab = 'sky';

      if (nextTab !== null && nextTab !== activeTabRef.current) {
        if (typeof window !== 'undefined') {
          tabScrollPositionsRef.current[activeTabRef.current] = window.scrollY;
        }
        setActiveTab(nextTab);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectLocation = (newLoc: LocationData) => {
    setLocation(newLoc);
    saveStoredLocation(newLoc);
  };

  useEffect(() => {
    const handleLocationChanged = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      const detail: unknown = e.detail;
      if (isLocationData(detail)) {
        setLocation(detail);
      }
    };
    const handleWeatherNav = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      const detail: unknown = e.detail;
      if (typeof detail !== 'object' || detail === null) return;

      if ('site' in detail && isLocationData(detail.site)) {
        setInspectedWeatherSite(detail.site);
      }
      if ('dateKey' in detail && typeof detail.dateKey === 'string') {
        setSelectedNightKey(detail.dateKey);
      }
      if (typeof window !== 'undefined') {
        tabScrollPositionsRef.current[activeTabRef.current] = window.scrollY;
      }
      setActiveTab('weather');
      window.location.hash = '#tabWeather';
      let targetId = 'section-temperature';
      if ('targetSection' in detail && typeof detail.targetSection === 'string' && detail.targetSection.length > 0) {
        targetId = detail.targetSection;
      }
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 120);
    };

    window.addEventListener('chroma_location_changed', handleLocationChanged);
    window.addEventListener('chroma_navigate_weather_section', handleWeatherNav);
    return () => {
      window.removeEventListener('chroma_location_changed', handleLocationChanged);
      window.removeEventListener('chroma_navigate_weather_section', handleWeatherNav);
    };
  }, []);

  const handleNavigateToWeatherFromCalendar = (
    site: LocationData,
    targetSection: string = 'section-temperature',
    dateKey?: string
  ) => {
    setInspectedWeatherSite(site);
    if (dateKey) {
      setSelectedNightKey(dateKey);
    }
    if (typeof window !== 'undefined') {
      tabScrollPositionsRef.current[activeTabRef.current] = window.scrollY;
    }
    setActiveTab('weather');
    window.location.hash = '#tabWeather';
    setTimeout(() => {
      document.getElementById(targetSection)?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };

  const handleNavigateToSkyFromCalendar = (date: Date) => {
    if (typeof window !== 'undefined') {
      tabScrollPositionsRef.current[activeTabRef.current] = window.scrollY;
    }
    setSkySelectedDate(date);
    setActiveTab('sky');
    window.location.hash = '#tabSky';
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] transition-colors duration-200"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <Header
        location={location}
        activeTab={activeTab}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        selectedNightKey={selectedNightKey}
        timeZone={resolvedSite?.timeZone}
        onPrevNight={() => {
          if (selectedNightKey) {
            setSelectedNightKey(addDaysToDateKey(selectedNightKey, -1));
          }
        }}
        onNextNight={() => {
          if (selectedNightKey) {
            setSelectedNightKey(addDaysToDateKey(selectedNightKey, 1));
          }
        }}
        onResetToday={() => {
          if (resolvedSite?.timeZone) {
            setSelectedNightKey(currentNightKey(Date.now(), resolvedSite.timeZone));
          }
        }}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onOpenBriefingModal={handleOpenBriefing}
        isNightLock={isNightLock}
        onToggleNightLock={() => setIsNightLock((prev) => !prev)}
      />
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 pt-3.5 sm:pt-5 overflow-y-auto">
        {!resolvedSite ? (
          <NeedsTimeZone
            site={location}
            onResolved={setLocation}
          />
        ) : (
          <>
            {visitedTabs.calendar && (
              <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
                <NightCalendarTab
                  location={resolvedSite}
                  selectedNightKey={selectedNightKey}
                  onSelectNightKey={setSelectedNightKey}
                  onNavigateToSky={handleNavigateToSkyFromCalendar}
                  onNavigateToWeather={handleNavigateToWeatherFromCalendar}
                />
              </div>
            )}
            {visitedTabs.weather && (
              <div style={{ display: (activeTab === 'weather' || activeTab === 'fieldWeather') ? 'block' : 'none' }}>
                <FieldWeatherTab
                  location={resolvedSite}
                  originFavoriteSite={resolveSite(inspectedWeatherSite)}
                  selectedNightKey={selectedNightKey}
                  onSelectNightKey={setSelectedNightKey}
                />
              </div>
            )}
            {visitedTabs.route && (
              <div style={{ display: activeTab === 'route' ? 'block' : 'none' }}>
                <RouteTab
                  location={resolvedSite}
                  selectedNightKey={selectedNightKey}
                  onOpenLocationModal={() => setIsLocationModalOpen(true)}
                />
              </div>
            )}
            {visitedTabs.targets && (
              <div style={{ display: activeTab === 'targets' ? 'block' : 'none' }}>
                <TargetOpsTab
                  location={resolvedSite}
                  selectedNightKey={selectedNightKey}
                />
              </div>
            )}
            {visitedTabs.sky && (
              <div style={{ display: activeTab === 'sky' ? 'block' : 'none' }}>
                <SkyVizorTab location={resolvedSite} initialDate={skySelectedDate} />
              </div>
            )}
          </>
        )}
      </main>
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        activeLocation={location}
        onSelectLocation={handleSelectLocation}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentTheme={theme}
        onSelectTheme={setTheme}
      />
      <StationBriefingModal
        isOpen={isBriefingModalOpen}
        onClose={() => setIsBriefingModalOpen(false)}
        location={location}
        onOpenLocationModal={() => {
          setIsBriefingModalOpen(false);
          setIsLocationModalOpen(true);
        }}
        onSelectTab={(tabHash) => {
          if (typeof window !== 'undefined') {
            tabScrollPositionsRef.current[activeTabRef.current] = window.scrollY;
          }
          setIsBriefingModalOpen(false);
          window.location.hash = tabHash;
        }}
      />
      {resolvedSite && (
        <MiniCalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
          selectedDate={siteNoon(selectedNightKey, resolvedSite.timeZone)}
          onSelectDate={(newDate) => {
            setSelectedNightKey(siteDateKey(newDate, resolvedSite.timeZone));
            setIsCalendarModalOpen(false);
          }}
          latitude={resolvedSite.latitude}
          longitude={resolvedSite.longitude}
          elevation={resolvedSite.elevation}
          timeZone={resolvedSite.timeZone}
          siteTodayKey={currentNightKey(Date.now(), resolvedSite.timeZone)}
        />
      )}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (typeof window !== 'undefined') {
            tabScrollPositionsRef.current[activeTabRef.current] = window.scrollY;
          }
          setActiveTab(tab);
          if (tab === 'weather') {
            setInspectedWeatherSite(null);
          }
        }}
      />
    </div>
  );
}
