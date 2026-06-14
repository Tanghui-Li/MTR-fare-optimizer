import { useState, useEffect, useMemo } from 'react'
import ControlPanel from './components/ControlPanel'
import RouteVisualizer from './components/RouteVisualizer'
import MapView from './components/MapView'
import AccessibilityFilter from './components/AccessibilityFilter'
import { findMultimodalRoute } from './routePlanner'
import { unifiedStationMap } from './data/unifiedNetwork'
import { getFareMatrix } from './data/mtrFareMatrix'
import { RouteResult, StationMap, TicketType, DetailedSegment, Locale, Poi, PoiCategory, PoiSort } from './types'
import { formatCurrency, localeOptions, t } from './i18n'
import { SlidersHorizontal, Compass } from 'lucide-react'
import { useMobileSheetDrag } from './hooks/useMobileSheetDrag'
import { getLocalizedText, getSecondaryLocalizedText } from './data/zhHansText'
import NearbyPanel from './components/NearbyPanel'
import { useNearbyPois, stationHasPois } from './hooks/useNearbyPois'
import { haversineMeters, walkMinutes } from './utils/geo'
import { stationCoordinates } from './data/stationCoordinates'

const stations = unifiedStationMap as StationMap
type RouteMode = 'optimized' | 'boring';
interface RouteSearchParams {
  originId: string | null
  destinationId: string | null
  ticketType: TicketType
}

const initialSearchParams: RouteSearchParams = {
  originId: null,
  destinationId: null,
  ticketType: 'octopus',
}

const MOBILE_SHEET_QUERY = '(max-width: 900px), ((max-height: 600px) and (hover: none) and (pointer: coarse))';

function getRouteSheetHeight() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const preferredHeight = Math.round(viewportHeight * 0.58);
  const maxHeight = Math.max(180, viewportHeight - 180);
  const minHeight = Math.min(320, maxHeight);

  return Math.max(minHeight, Math.min(preferredHeight, maxHeight));
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_SHEET_QUERY).matches;
}

interface MobileRouteSummaryProps {
  routeResult: RouteResult
  stations: StationMap
  originId: string
  destinationId: string
  directFare: number
  locale: Locale
}

function MobileRouteSummary({ routeResult, stations, originId, destinationId, directFare, locale }: MobileRouteSummaryProps) {
  const origin = stations[originId]
  const destination = stations[destinationId]
  const savings = directFare - routeResult.totalFare
  const hasSavings = savings > 0.01

  if (!origin || !destination) return null

  return (
    <section className="mobile-route-summary" role="status" aria-live="polite" aria-label={t(locale, 'routeResultSummary')}>
      <div className="mobile-route-summary-main">
        <span className="mobile-route-summary-label">
          {hasSavings ? t(locale, 'optimizedRoute') : t(locale, 'standardBestRoute')}
        </span>
        <strong className="mobile-route-summary-fare">{formatCurrency(routeResult.totalFare)}</strong>
      </div>
      <div className="mobile-route-summary-route">
        {getLocalizedText(origin, locale)}
        <span aria-hidden="true">→</span>
        {getLocalizedText(destination, locale)}
      </div>
      <div className="mobile-route-summary-note">
        {hasSavings ? `${t(locale, 'youSaved')} ${formatCurrency(savings)}` : t(locale, 'noSavingsTitle')}
      </div>
    </section>
  )
}

function SameStationNotice({ stationId, stations, locale }: { stationId: string; stations: StationMap; locale: Locale }) {
  const station = stations[stationId]
  if (!station) return null

  return (
    <section className="same-station-notice" role="status" aria-live="polite">
      <h2>{t(locale, 'sameStationTitle')}</h2>
      <p>
        {getLocalizedText(station, locale)} · {t(locale, 'sameStationBody')}
      </p>
    </section>
  )
}

function PlanningStatus({
  originId,
  destinationId,
  hasAppliedRoute,
  hasUnappliedChanges,
  isSameStation,
  locale,
}: {
  originId: string | null
  destinationId: string | null
  hasAppliedRoute: boolean
  hasUnappliedChanges: boolean
  isSameStation: boolean
  locale: Locale
}) {
  if (isSameStation) return null
  if (originId && destinationId && hasAppliedRoute && !hasUnappliedChanges) return null

  let message = t(locale, 'planningStatusSelectBoth')
  if (hasUnappliedChanges) {
    message = t(locale, 'planningStatusUnapplied')
  } else if (originId && destinationId) {
    message = t(locale, 'planningStatusReady')
  } else if (!originId && destinationId) {
    message = t(locale, 'planningStatusNeedOrigin')
  } else if (originId && !destinationId) {
    message = t(locale, 'planningStatusNeedDestination')
  }

  return (
    <section className="planning-status" role="status" aria-live="polite">
      <h2>{t(locale, 'planningStatusTitle')}</h2>
      <p>{message}</p>
    </section>
  )
}

function App() {
  const [draftSearchParams, setDraftSearchParams] = useState<RouteSearchParams>(initialSearchParams)
  const [submittedSearchParams, setSubmittedSearchParams] = useState<RouteSearchParams>(initialSearchParams)
  const [locale, setLocale] = useState<Locale>('zh-Hant')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  
  const { sheetRef, setSheetHeight, isExpanded: isSheetExpanded, handlers: dragHandlers } = useMobileSheetDrag(400)
  
  // Map Layer Controls State
  const [showBuses, setShowBuses] = useState(() => !isMobileViewport());
  const [showBusStops, setShowBusStops] = useState(() => !isMobileViewport());
  const [showLRT, setShowLRT] = useState(true);
  const [showNearbyStations, setShowNearbyStations] = useState(true);
  const [mobileLayerControlsOpen, setMobileLayerControlsOpen] = useState(false);
  const [accessibilityFilter, setAccessibilityFilter] = useState<string[][]>([]);

  // ===== Nearby Explore（周边探索）state =====
  const [nearbyStationId, setNearbyStationId] = useState<string | null>(null);
  const [poiCategory, setPoiCategory] = useState<PoiCategory>('all');
  const [poiCuisine, setPoiCuisine] = useState<string | null>(null);
  const [poiRadius, setPoiRadius] = useState(500);
  const [poiSort, setPoiSort] = useState<PoiSort>('recommend');
  const [expandedPoiId, setExpandedPoiId] = useState<string | null>(null);
  const [activePoiId, setActivePoiId] = useState<string | null>(null);
  const [flyNonce, setFlyNonce] = useState(0);
  const [poiTour, setPoiTour] = useState<string[]>([]);
  const [poiFavorites, setPoiFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('mtr.poi.favorites');
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mtr.poi.favorites', JSON.stringify([...poiFavorites]));
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
  }, [poiFavorites]);

  const nearbyResult = useNearbyPois(nearbyStationId, {
    category: poiCategory,
    cuisine: poiCuisine,
    radius: poiRadius,
    sort: poiSort,
  });

  const tourPois = useMemo<Poi[]>(() => {
    if (!nearbyStationId || poiTour.length === 0) return [];
    const byId = new Map(nearbyResult.all.map((p) => [p.id, p]));
    const picked = poiTour
      .map((id) => byId.get(id))
      .filter((p): p is Poi => Boolean(p));
    const center = stationCoordinates[nearbyStationId];
    if (!center) return picked;
    // 从车站出发的最近邻排序，生成步行串游顺序
    const remaining = [...picked];
    const ordered: Poi[] = [];
    let curLat = center.lat;
    let curLng = center.lng;
    while (remaining.length > 0) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i += 1) {
        const d = haversineMeters(curLat, curLng, remaining[i].lat, remaining[i].lng);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      const next = remaining.splice(best, 1)[0];
      ordered.push(next);
      curLat = next.lat;
      curLng = next.lng;
    }
    return ordered;
  }, [nearbyStationId, poiTour, nearbyResult.all]);

  const tourTotalMin = useMemo(() => {
    if (!nearbyStationId || tourPois.length === 0) return 0;
    const center = stationCoordinates[nearbyStationId];
    if (!center) return 0;
    let total = 0;
    let lat = center.lat;
    let lng = center.lng;
    for (const p of tourPois) {
      total += haversineMeters(lat, lng, p.lat, p.lng);
      lat = p.lat;
      lng = p.lng;
    }
    return walkMinutes(total);
  }, [nearbyStationId, tourPois]);

  const handleOpenNearby = (stationId: string) => {
    setNearbyStationId(stationId);
    setPoiCategory('all');
    setPoiCuisine(null);
    setPoiSort('recommend');
    setExpandedPoiId(null);
    setActivePoiId(null);
    setPoiTour([]);
  };
  const handleCloseNearby = () => {
    setNearbyStationId(null);
    setActivePoiId(null);
    setExpandedPoiId(null);
  };
  const handleToggleExpand = (id: string) => {
    setExpandedPoiId((prev) => (prev === id ? null : id));
    setActivePoiId(id);
    setFlyNonce((n) => n + 1);
  };
  const handleSelectPoi = (id: string) => {
    setActivePoiId(id);
    setExpandedPoiId(id);
  };
  const handleLocatePoi = (poi: Poi) => {
    setActivePoiId(poi.id);
    setExpandedPoiId(poi.id);
    setFlyNonce((n) => n + 1);
  };
  const handleToggleFavorite = (id: string) => {
    setPoiFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleToggleTour = (id: string) => {
    setPoiTour((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const handleShufflePoi = (list: Poi[]) => {
    if (list.length === 0) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    handleLocatePoi(pick);
  };

  const [displayedRouteInfo, setDisplayedRouteInfo] = useState({
    originId: null as string | null,
    destinationId: null as string | null,
    ticketType: 'octopus' as TicketType,
    directFare: 0,
  })

  // Route visualization state
  const [routeMode, setRouteMode] = useState<RouteMode>('optimized')
  const [optimizedSegments, setOptimizedSegments] = useState<DetailedSegment[]>([])
  const [boringSegments, setBoringSegments] = useState<DetailedSegment[]>([])

  // The segments currently shown on the map
  const activeSegments = useMemo(() => {
    return routeMode === 'optimized' ? optimizedSegments : boringSegments;
  }, [routeMode, optimizedSegments, boringSegments]);
  const sameStationId = draftSearchParams.originId && draftSearchParams.destinationId && draftSearchParams.originId === draftSearchParams.destinationId
    ? draftSearchParams.originId
    : null;
  const hasCompleteDraft = Boolean(draftSearchParams.originId && draftSearchParams.destinationId);
  const hasAppliedRoute = Boolean(routeResult && displayedRouteInfo.originId && displayedRouteInfo.destinationId);
  const hasUnappliedChanges = hasAppliedRoute && (
    draftSearchParams.originId !== submittedSearchParams.originId ||
    draftSearchParams.destinationId !== submittedSearchParams.destinationId ||
    draftSearchParams.ticketType !== submittedSearchParams.ticketType
  );
  const canPlanRoute = hasCompleteDraft && !sameStationId;

  const handleSubmitRoute = () => {
    if (!canPlanRoute) return
    setSubmittedSearchParams(draftSearchParams)
    setRouteMode('optimized')
  }

  const handleClearRoute = () => {
    const clearedParams = {
      ...draftSearchParams,
      originId: null,
      destinationId: null,
    }
    setDraftSearchParams(clearedParams)
    setSubmittedSearchParams(clearedParams)
    setRouteMode('optimized')
  }

  useEffect(() => {
    if (submittedSearchParams.originId && submittedSearchParams.destinationId) {
      if (submittedSearchParams.originId === submittedSearchParams.destinationId) {
        setRouteResult(null)
        setDisplayedRouteInfo({
          originId: null,
          destinationId: null,
          ticketType: submittedSearchParams.ticketType,
          directFare: 0,
        })
        setOptimizedSegments([])
        setBoringSegments([])
        return
      }

      const matrixToUse = getFareMatrix(submittedSearchParams.ticketType);
      const optimizedResult = findMultimodalRoute(matrixToUse, submittedSearchParams.originId, submittedSearchParams.destinationId, submittedSearchParams.ticketType, 'optimized')
      const boringResult = findMultimodalRoute(matrixToUse, submittedSearchParams.originId, submittedSearchParams.destinationId, submittedSearchParams.ticketType, 'boring')

      setRouteResult(optimizedResult)
      setDisplayedRouteInfo({
        originId: submittedSearchParams.originId,
        destinationId: submittedSearchParams.destinationId,
        ticketType: submittedSearchParams.ticketType,
        directFare: boringResult.totalFare,
      })
      setOptimizedSegments(optimizedResult.segments || [])
      setBoringSegments(boringResult.segments || [])

    } else {
      setRouteResult(null)
      setDisplayedRouteInfo({
        originId: null,
        destinationId: null,
        ticketType: submittedSearchParams.ticketType,
        directFare: 0,
      })
      setOptimizedSegments([])
      setBoringSegments([])
    }
  }, [submittedSearchParams])

  useEffect(() => {
    if (!routeResult) {
      setSheetHeight(null)
      return
    }

    const updateSheetHeight = () => {
      if (window.matchMedia(MOBILE_SHEET_QUERY).matches) {
        setSheetHeight(getRouteSheetHeight())
      } else {
        setSheetHeight(null)
      }
    }

    updateSheetHeight()
    window.addEventListener('resize', updateSheetHeight)
    window.visualViewport?.addEventListener('resize', updateSheetHeight)

    return () => {
      window.removeEventListener('resize', updateSheetHeight)
      window.visualViewport?.removeEventListener('resize', updateSheetHeight)
    }
  }, [routeResult, setSheetHeight])



  return (
    <div className="app-root">
      {/* Top Navigation */}
      <nav className="tab-nav">
        <div className="tab-nav-inner">
          <div className="tab-brand">
            <span className="tab-brand-icon">🚇</span>
            <span className="tab-brand-text">{t(locale, 'appBrand')}</span>
          </div>
          <div className="tab-nav-actions">
            <div className="tab-nav-actions-group">
              <button
                type="button"
                className="map-layer-toggle-button"
                onClick={() => setMobileLayerControlsOpen((open) => !open)}
                aria-expanded={mobileLayerControlsOpen}
                aria-controls="map-layer-controls"
                aria-label={t(locale, 'mapLayers')}
              >
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                {t(locale, 'mapLayers')}
              </button>
              <AccessibilityFilter
                filter={accessibilityFilter}
                onFilterChange={setAccessibilityFilter}
                locale={locale}
              />
            </div>
            <div className="lang-switcher" role="group" aria-label={t(locale, 'language')}>
              {localeOptions.map((option) => (
                <button
                  key={option.value}
                  className={`lang-switcher-btn ${locale === option.value ? 'active' : ''}`}
                  onClick={() => setLocale(option.value)}
                  aria-pressed={locale === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Unified Layout: Left Panel + Map */}
      <div className="unified-layout">
        {/* Left Panel: Controls + Results */}
        <div 
          ref={sheetRef}
          className="left-panel"
        >
          <button
            type="button"
            className="mobile-sheet-toggle"
            aria-label={isSheetExpanded ? t(locale, 'collapsePanel') : t(locale, 'expandPanel')}
            aria-expanded={isSheetExpanded}
            title={isSheetExpanded ? t(locale, 'collapsePanel') : t(locale, 'expandPanel')}
            {...dragHandlers}
          >
            <span className="mobile-sheet-grip" />
          </button>
          <div className="left-panel-inner">
            {/* Compact Header */}
            <header className="compact-header">
              <h1>{t(locale, 'heroTitle')}</h1>
              <p>"{t(locale, 'heroTagline')}"</p>
            </header>
            
            <ControlPanel 
              originId={draftSearchParams.originId}
              destinationId={draftSearchParams.destinationId}
              ticketType={draftSearchParams.ticketType}
              onOriginChange={(id) => setDraftSearchParams(prev => ({ ...prev, originId: id }))}
              onDestinationChange={(id) => setDraftSearchParams(prev => ({ ...prev, destinationId: id }))}
              onTicketTypeChange={(type) => setDraftSearchParams(prev => ({ ...prev, ticketType: type }))}
              onClearRoute={handleClearRoute}
              onPlanRoute={handleSubmitRoute}
              canPlanRoute={canPlanRoute}
              hasAppliedRoute={hasAppliedRoute}
              hasUnappliedChanges={hasUnappliedChanges}
              locale={locale}
            />

            <PlanningStatus
              originId={draftSearchParams.originId}
              destinationId={draftSearchParams.destinationId}
              hasAppliedRoute={hasAppliedRoute}
              hasUnappliedChanges={hasUnappliedChanges}
              isSameStation={Boolean(sameStationId)}
              locale={locale}
            />

            {sameStationId && (
              <SameStationNotice
                stationId={sameStationId}
                stations={stations}
                locale={locale}
              />
            )}

            {routeResult && displayedRouteInfo.originId && displayedRouteInfo.destinationId && (
              <MobileRouteSummary
                routeResult={routeResult}
                stations={stations}
                originId={displayedRouteInfo.originId}
                destinationId={displayedRouteInfo.destinationId}
                directFare={displayedRouteInfo.directFare}
                locale={locale}
              />
            )}

            {routeResult && displayedRouteInfo.originId && displayedRouteInfo.destinationId && (
              <RouteVisualizer 
                routeResult={routeResult} 
                stations={stations}
                directFare={displayedRouteInfo.directFare}
                ticketType={displayedRouteInfo.ticketType}
                routeMode={routeMode}
                onRouteModeChange={setRouteMode}
                optimizedSegments={optimizedSegments}
                boringSegments={boringSegments}
                locale={locale}
              />
            )}

            {displayedRouteInfo.destinationId && stationHasPois(displayedRouteInfo.destinationId) && (
              <button
                type="button"
                className="nearby-cta"
                onClick={() => handleOpenNearby(displayedRouteInfo.destinationId as string)}
              >
                <span className="nearby-cta-icon" aria-hidden="true">
                  <Compass className="w-4 h-4" />
                </span>
                <span className="nearby-cta-text">
                  <strong>{t(locale, 'nearbyDestinationCta')}</strong>
                  <span>{getLocalizedText(stations[displayedRouteInfo.destinationId], locale)}</span>
                </span>
                <span className="nearby-cta-arrow" aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Map */}
        <div className="right-panel">
          <MapView
            routeSegments={activeSegments.length > 0 ? activeSegments : undefined}
            originId={displayedRouteInfo.originId}
            destinationId={displayedRouteInfo.destinationId}
            locale={locale}
            showBuses={showBuses}
            showBusStops={showBusStops}
            showLRT={showLRT}
            setShowBuses={setShowBuses}
            setShowBusStops={setShowBusStops}
            setShowLRT={setShowLRT}
            mobileLayerControlsOpen={mobileLayerControlsOpen}
            accessibilityFilter={accessibilityFilter}
            showNearbyStations={showNearbyStations}
            setShowNearbyStations={setShowNearbyStations}
            onOpenNearby={handleOpenNearby}
            nearbyStationId={nearbyStationId}
            nearbyPois={nearbyResult.filtered}
            nearbyRadius={poiRadius}
            activePoiId={activePoiId}
            flyNonce={flyNonce}
            tourPois={tourPois}
            onSelectPoi={handleSelectPoi}
          />
          {nearbyStationId && stations[nearbyStationId] && (
            <NearbyPanel
              open={Boolean(nearbyStationId)}
              stationName={getLocalizedText(stations[nearbyStationId], locale)}
              stationSecondary={getSecondaryLocalizedText(stations[nearbyStationId], locale)}
              locale={locale}
              result={nearbyResult}
              category={poiCategory}
              cuisine={poiCuisine}
              radius={poiRadius}
              sort={poiSort}
              expandedPoiId={expandedPoiId}
              activePoiId={activePoiId}
              favorites={poiFavorites}
              tourPois={tourPois}
              tourTotalMin={tourTotalMin}
              onCategory={setPoiCategory}
              onCuisine={setPoiCuisine}
              onRadius={setPoiRadius}
              onSort={setPoiSort}
              onToggleExpand={handleToggleExpand}
              onLocate={handleLocatePoi}
              onToggleFavorite={handleToggleFavorite}
              onToggleTour={handleToggleTour}
              onClearTour={() => setPoiTour([])}
              onShuffle={handleShufflePoi}
              onClose={handleCloseNearby}
            />
          )}
          <div className="global-map-attribution">
            Leaflet | {t(locale, 'mapFromLabel')} <a href="https://www.landsd.gov.hk/" target="_blank" rel="noopener noreferrer">{t(locale, 'landsDepartment')}</a> | {t(locale, 'dataSourcesLabel')} <a href="https://data.gov.hk" target="_blank" rel="noopener noreferrer">{t(locale, 'dataGovHongKong')}</a>, <a href="https://geodata.gov.hk" target="_blank" rel="noopener noreferrer">{t(locale, 'geospatialDataPlatform')}</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
