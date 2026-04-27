import { useState, useEffect } from 'react'
import Header from './components/Header'
import ControlPanel from './components/ControlPanel'
import RouteVisualizer from './components/RouteVisualizer'
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
              // AEL Link: Both stations are AEL stations and there's a cost > 0
              // In the merged matrix, links like 39->47 or 40->47 are AEL links.
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
                  // Only forbid the actual AEL segments (like 39->47)
                  // The virtual moves (like 1->39) should stay if they are 0
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
          // Adult Single AEL Departure Logic:
          // 1. First check if a direct fare exists (e.g. Expo to Airport)
          const actualDirect = rawFareMatrix['single'][originId]?.[destinationId];
          
          if (actualDirect !== undefined && actualDirect < Infinity) {
            calculatedDirectFare = actualDirect;
          } else {
            // 2. Fallback to minimum of "Fare(Start -> Hub) + Fare(Hub -> End)" for hubs in {39, 40, 42}
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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
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
  )
}

export default App
