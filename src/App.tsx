import { useState, useEffect, useMemo } from 'react'
import ControlPanel from './components/ControlPanel'
import RouteVisualizer from './components/RouteVisualizer'
import MapView from './components/MapView'
import { findCheapestRoute } from './pathfinder'
import { planDetailedRoute, planBoringRoute } from './routePlanner'
import stationsData from './stations.json'
import fareMatrixData from './fare_matrix.json'
import { RouteResult, StationMap, TicketType, UnifiedFareMatrix, FareMatrix, DetailedSegment } from './types'

const stations = stationsData as StationMap
const rawFareMatrix = fareMatrixData as UnifiedFareMatrix

// Merged Hub IDs: Hong Kong (39), Kowloon (40), Tsing Yi (42)
// AEL Stations after merge: Hubs + Airport (47) + AsiaWorld-Expo (56)
const HUB_STATIONS = ['39', '40', '42'];
const AIRPORT_EXPO_STATIONS = ['47', '56'];
const AEL_STATIONS = [...HUB_STATIONS, ...AIRPORT_EXPO_STATIONS];

type RouteMode = 'optimized' | 'boring';

function App() {
  const [originId, setOriginId] = useState<string | null>(null)
  const [destinationId, setDestinationId] = useState<string | null>(null)
  const [ticketType, setTicketType] = useState<TicketType>('octopus')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  
  const [displayedOriginId, setDisplayedOriginId] = useState<string | null>(null)
  const [displayedDestinationId, setDisplayedDestinationId] = useState<string | null>(null)
  const [displayedTicketType, setDisplayedTicketType] = useState<TicketType>('octopus')
  const [directFare, setDirectFare] = useState<number>(0)
  const [boringRouteDetails, setBoringRouteDetails] = useState<{hubId: string, fare1: number, fare2: number} | undefined>(undefined)
  const [activeMatrix, setActiveMatrix] = useState<FareMatrix | null>(null)

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
      const isAELTrip = AIRPORT_EXPO_STATIONS.includes(originId) || AIRPORT_EXPO_STATIONS.includes(destinationId);
      let matrixToUse: FareMatrix = JSON.parse(JSON.stringify(rawFareMatrix[ticketType]));

      if (ticketType === 'octopus') {
        if (isAELTrip) {
          // Octopus AEL: MTR part is free
          for (const src in matrixToUse) {
            for (const dest in matrixToUse[src]) {
              const isSrcAEL = AEL_STATIONS.includes(src);
              const isDestAEL = AEL_STATIONS.includes(dest);
              const isAELLink = isSrcAEL && isDestAEL && matrixToUse[src][dest] > 0;
              
              if (!isAELLink) {
                matrixToUse[src][dest] = 0;
              }
            }
          }
        } else {
          // Octopus Non-AEL: AEL is forbidden
          for (const src in matrixToUse) {
            if (AEL_STATIONS.includes(src)) {
              for (const dest in matrixToUse[src]) {
                if (AEL_STATIONS.includes(dest) && matrixToUse[src][dest] > 0) {
                  if (AIRPORT_EXPO_STATIONS.includes(src) || AIRPORT_EXPO_STATIONS.includes(dest)) {
                    matrixToUse[src][dest] = Infinity;
                  }
                }
              }
            }
          }
        }
      }

      const result = findCheapestRoute(matrixToUse, originId, destinationId)
      
      // Calculate directFare for display
      let calculatedDirectFare = originId === destinationId
        ? 0
        : (rawFareMatrix[ticketType][originId]?.[destinationId] || Infinity);
      let boringDetails: { hubId: string, fare1: number, fare2: number } | undefined = undefined;
      
      if (isAELTrip) {
        if (ticketType === 'octopus') {
          calculatedDirectFare = result.totalFare;
        } else {
          const actualDirect = rawFareMatrix['single'][originId]?.[destinationId];
          
          if (actualDirect !== undefined && actualDirect < Infinity) {
            calculatedDirectFare = actualDirect;
          } else {
            let minOneStopFare = Infinity;
            for (const hubId of HUB_STATIONS) {
              const fare1 = rawFareMatrix['single'][originId]?.[hubId] || Infinity;
              const fare2 = rawFareMatrix['single'][hubId]?.[destinationId] || Infinity;
              if (fare1 + fare2 < minOneStopFare) {
                minOneStopFare = fare1 + fare2;
                boringDetails = { hubId, fare1, fare2 };
              }
            }
            calculatedDirectFare = minOneStopFare;
          }
        }
      }

      // Plan detailed paths for both modes
      // Optimized route: use Dijkstra result segments
      const forbiddenForOptimized = (!isAELTrip && ticketType === 'octopus') ? new Set(['AEL']) : undefined;
      const optSegments = planDetailedRoute(result.route, matrixToUse, forbiddenForOptimized);

      // Boring route: direct or through hub
      const boringFareMatrix = rawFareMatrix[ticketType];
      const borSegments = planBoringRoute(
        originId,
        destinationId,
        calculatedDirectFare,
        boringFareMatrix,
        boringDetails,
      );

      setRouteResult(result)
      setDisplayedOriginId(originId)
      setDisplayedDestinationId(destinationId)
      setDisplayedTicketType(ticketType)
      setDirectFare(calculatedDirectFare)
      setBoringRouteDetails(boringDetails)
      setActiveMatrix(matrixToUse)
      setOptimizedSegments(optSegments)
      setBoringSegments(borSegments)

    } else {
      setRouteResult(null)
      setActiveMatrix(null)
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
            <span className="tab-brand-text">MTR <span className="tab-brand-accent">Tools</span></span>
          </div>
          <div className="tab-brand-sub">
            票價計算 · 路線規劃 · 實時地圖
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
              <h1>MTR Fare <span>Optimizer</span></h1>
              <p>"Because why pay full price when you can walk through a gate?"</p>
            </header>
            
            <ControlPanel 
              stations={stations}
              originId={originId}
              destinationId={destinationId}
              ticketType={ticketType}
              onOriginChange={setOriginId}
              onDestinationChange={setDestinationId}
              onTicketTypeChange={setTicketType}
            />

            {routeResult && displayedOriginId && displayedDestinationId && activeMatrix && (
              <RouteVisualizer 
                routeResult={routeResult} 
                stations={stations}
                directFare={directFare}
                originId={displayedOriginId}
                destinationId={displayedDestinationId}
                ticketType={displayedTicketType}
                boringRouteDetails={boringRouteDetails}
                activeMatrix={activeMatrix}
                routeMode={routeMode}
                onRouteModeChange={setRouteMode}
                optimizedSegments={optimizedSegments}
                boringSegments={boringSegments}
              />
            )}
            <div style={{ textAlign: 'center', padding: '20px', opacity: 0.3, fontSize: '10px' }}>
              UI Version: 2.1.0-neutral-grey
            </div>
          </div>
        </div>

        {/* Right: Map */}
        <div className="right-panel">
          <MapView
            routeSegments={activeSegments.length > 0 ? activeSegments : undefined}
            originId={displayedOriginId}
            destinationId={displayedDestinationId}
          />
        </div>
      </div>
    </div>
  )
}

export default App
