import { useState, useEffect, useMemo } from 'react'
import ControlPanel from './components/ControlPanel'
import RouteVisualizer from './components/RouteVisualizer'
import MapView from './components/MapView'
import { findMultimodalRoute } from './routePlanner'
import { unifiedStationMap } from './data/unifiedNetwork'
import fareMatrixData from './fare_matrix.json'
import { RouteResult, StationMap, TicketType, UnifiedFareMatrix, FareMatrix, DetailedSegment, Locale } from './types'
import { localeOptions, t } from './i18n'

const stations = unifiedStationMap as StationMap
const rawFareMatrix = fareMatrixData as UnifiedFareMatrix

type RouteMode = 'optimized' | 'boring';

function App() {
  const [originId, setOriginId] = useState<string | null>(null)
  const [destinationId, setDestinationId] = useState<string | null>(null)
  const [ticketType, setTicketType] = useState<TicketType>('octopus')
  const [locale, setLocale] = useState<Locale>('zh-Hant')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  
  const [displayedOriginId, setDisplayedOriginId] = useState<string | null>(null)
  const [displayedDestinationId, setDisplayedDestinationId] = useState<string | null>(null)
  const [displayedTicketType, setDisplayedTicketType] = useState<TicketType>('octopus')
  const [directFare, setDirectFare] = useState<number>(0)

  // Route visualization state
  const [routeMode, setRouteMode] = useState<RouteMode>('optimized')
  const [optimizedSegments, setOptimizedSegments] = useState<DetailedSegment[]>([])
  const [boringSegments, setBoringSegments] = useState<DetailedSegment[]>([])

  // The segments currently shown on the map
  const activeSegments = useMemo(() => {
    return routeMode === 'optimized' ? optimizedSegments : boringSegments;
  }, [routeMode, optimizedSegments, boringSegments]);

  useEffect(() => {
    if (originId && destinationId) {
      const matrixToUse: FareMatrix = JSON.parse(JSON.stringify(rawFareMatrix[ticketType]));
      const optimizedResult = findMultimodalRoute(matrixToUse, originId, destinationId, ticketType, 'optimized')
      const boringResult = findMultimodalRoute(matrixToUse, originId, destinationId, ticketType, 'boring')

      setRouteResult(optimizedResult)
      setDisplayedOriginId(originId)
      setDisplayedDestinationId(destinationId)
      setDisplayedTicketType(ticketType)
      setDirectFare(boringResult.totalFare)
      setOptimizedSegments(optimizedResult.segments || [])
      setBoringSegments(boringResult.segments || [])

    } else {
      setRouteResult(null)
      setOptimizedSegments([])
      setBoringSegments([])
    }
  }, [originId, destinationId, ticketType])

  return (
    <div className="app-root">
      {/* Top Navigation */}
      <nav className="tab-nav">
        <div className="tab-nav-inner">
          <div className="tab-brand">
            <span className="tab-brand-icon">🚇</span>
            <span className="tab-brand-text">{t(locale, 'appBrand')} <span className="tab-brand-accent">Tools</span></span>
          </div>
          <div className="tab-nav-actions">
            <div className="tab-brand-sub">
              {t(locale, 'appSubtitle')}
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
        <div className="left-panel">
          <div className="left-panel-inner">
            {/* Compact Header */}
            <header className="compact-header">
              <h1>MTR Fare <span>{t(locale, 'heroAccent')}</span></h1>
              <p>"{t(locale, 'heroTagline')}"</p>
            </header>
            
            <ControlPanel 
              originId={originId}
              destinationId={destinationId}
              ticketType={ticketType}
              onOriginChange={setOriginId}
              onDestinationChange={setDestinationId}
              onTicketTypeChange={setTicketType}
              locale={locale}
            />

            {routeResult && displayedOriginId && displayedDestinationId && (
              <RouteVisualizer 
                routeResult={routeResult} 
                stations={stations}
                directFare={directFare}
                ticketType={displayedTicketType}
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
            originId={displayedOriginId}
            destinationId={displayedDestinationId}
            locale={locale}
          />
        </div>
      </div>
    </div>
  )
}

export default App
