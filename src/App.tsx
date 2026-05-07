import { useState, useEffect } from 'react'
import Header from './components/Header'
import ControlPanel from './components/ControlPanel'
import RouteVisualizer from './components/RouteVisualizer'
import MapView from './components/MapView'
import { findCheapestRoute } from './pathfinder'
import stationsData from './stations.json'
import fareMatrixData from './fare_matrix.json'
import { RouteResult, StationMap, TicketType, UnifiedFareMatrix, FareMatrix } from './types'

const stations = stationsData as StationMap
const rawFareMatrix = fareMatrixData as UnifiedFareMatrix

// Merged Hub IDs: Hong Kong (39), Kowloon (40), Tsing Yi (42)
// AEL Stations after merge: Hubs + Airport (47) + AsiaWorld-Expo (56)
const HUB_STATIONS = ['39', '40', '42'];
const AIRPORT_EXPO_STATIONS = ['47', '56'];
const AEL_STATIONS = [...HUB_STATIONS, ...AIRPORT_EXPO_STATIONS];

type TabType = 'calculator' | 'map';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('calculator')
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
      let calculatedDirectFare = rawFareMatrix[ticketType][originId]?.[destinationId] || Infinity;
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

      setRouteResult(result)
      setDisplayedOriginId(originId)
      setDisplayedDestinationId(destinationId)
      setDisplayedTicketType(ticketType)
      setDirectFare(calculatedDirectFare)
      setBoringRouteDetails(boringDetails)
      setActiveMatrix(matrixToUse)

    } else {
      setRouteResult(null)
      setActiveMatrix(null)
    }
  }, [originId, destinationId, ticketType])

  return (
    <div className="app-root">
      {/* Tab Navigation */}
      <nav className="tab-nav">
        <div className="tab-nav-inner">
          <div className="tab-brand">
            <span className="tab-brand-icon">🚇</span>
            <span className="tab-brand-text">MTR <span className="tab-brand-accent">Tools</span></span>
          </div>
          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeTab === 'calculator' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('calculator')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="10" y2="10" />
                <line x1="14" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="10" y2="14" />
                <line x1="14" y1="14" x2="16" y2="14" />
                <line x1="8" y1="18" x2="16" y2="18" />
              </svg>
              票價計算器
            </button>
            <button
              className={`tab-btn ${activeTab === 'map' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              實時地圖
            </button>
          </div>
        </div>
      </nav>

      {/* Calculator Page */}
      {activeTab === 'calculator' && (
        <div className="page-calculator">
          <div className="max-w-2xl mx-auto space-y-8 p-4 md:p-8">
            <Header />
            
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
              />
            )}
          </div>
        </div>
      )}

      {/* Map Page */}
      {activeTab === 'map' && (
        <div className="page-map">
          <MapView />
        </div>
      )}
    </div>
  )
}

export default App
