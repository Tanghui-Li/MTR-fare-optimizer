import { useState, useEffect, useMemo } from 'react'
import ControlPanel from './components/ControlPanel'
import RouteVisualizer from './components/RouteVisualizer'
import MapView from './components/MapView'
import AccessibilityFilter from './components/AccessibilityFilter'
import { findMultimodalRoute } from './routePlanner'
import { unifiedStationMap } from './data/unifiedNetwork'
import { getFareMatrix } from './data/mtrFareMatrix'
import { RouteResult, StationMap, TicketType, DetailedSegment, Locale } from './types'
import { localeOptions, t } from './i18n'
import { SlidersHorizontal } from 'lucide-react'
import { useMobileSheetDrag } from './hooks/useMobileSheetDrag'

const stations = unifiedStationMap as StationMap
type RouteMode = 'optimized' | 'boring';
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

function App() {
  const [searchParams, setSearchParams] = useState({
    originId: null as string | null,
    destinationId: null as string | null,
    ticketType: 'octopus' as TicketType,
  })
  const [locale, setLocale] = useState<Locale>('zh-Hant')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  
  const { sheetRef, setSheetHeight, isExpanded: isSheetExpanded, handlers: dragHandlers } = useMobileSheetDrag(400)
  
  // Map Layer Controls State
  const [showBuses, setShowBuses] = useState(() => !isMobileViewport());
  const [showBusStops, setShowBusStops] = useState(() => !isMobileViewport());
  const [showLRT, setShowLRT] = useState(true);
  const [mobileLayerControlsOpen, setMobileLayerControlsOpen] = useState(false);
  const [accessibilityFilter, setAccessibilityFilter] = useState<string[][]>([]);
  
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

  useEffect(() => {
    if (searchParams.originId && searchParams.destinationId) {
      const matrixToUse = getFareMatrix(searchParams.ticketType);
      const optimizedResult = findMultimodalRoute(matrixToUse, searchParams.originId, searchParams.destinationId, searchParams.ticketType, 'optimized')
      const boringResult = findMultimodalRoute(matrixToUse, searchParams.originId, searchParams.destinationId, searchParams.ticketType, 'boring')

      setRouteResult(optimizedResult)
      setDisplayedRouteInfo({
        originId: searchParams.originId,
        destinationId: searchParams.destinationId,
        ticketType: searchParams.ticketType,
        directFare: boringResult.totalFare,
      })
      setOptimizedSegments(optimizedResult.segments || [])
      setBoringSegments(boringResult.segments || [])

    } else {
      setRouteResult(null)
      setOptimizedSegments([])
      setBoringSegments([])
    }
  }, [searchParams])

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
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t(locale, 'mapLayers')}
              </button>
              <AccessibilityFilter
                filter={accessibilityFilter}
                onFilterChange={setAccessibilityFilter}
                locale={locale}
              />
            </div>
            <div className="lang-switcher" aria-label={t(locale, 'language')}>
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
              originId={searchParams.originId}
              destinationId={searchParams.destinationId}
              ticketType={searchParams.ticketType}
              onOriginChange={(id) => setSearchParams(prev => ({ ...prev, originId: id }))}
              onDestinationChange={(id) => setSearchParams(prev => ({ ...prev, destinationId: id }))}
              onTicketTypeChange={(type) => setSearchParams(prev => ({ ...prev, ticketType: type }))}
              locale={locale}
            />

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
          />
          <div className="global-map-attribution">
            Leaflet | {t(locale, 'mapFromLabel')} <a href="https://www.landsd.gov.hk/" target="_blank" rel="noopener noreferrer">{t(locale, 'landsDepartment')}</a> | {t(locale, 'dataSourcesLabel')} <a href="https://data.gov.hk" target="_blank" rel="noopener noreferrer">{t(locale, 'dataGovHongKong')}</a>, <a href="https://geodata.gov.hk" target="_blank" rel="noopener noreferrer">{t(locale, 'geospatialDataPlatform')}</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
