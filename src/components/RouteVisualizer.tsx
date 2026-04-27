import { RouteResult, StationMap, TicketType, FareMatrix } from '../types'
import DirectRouteCard from './DirectRouteCard'
import FragmentedRouteCard from './FragmentedRouteCard'
import { TrendingDown } from 'lucide-react'

interface RouteVisualizerProps {
  routeResult: RouteResult
  stations: StationMap
  directFare: number
  originId: string
  destinationId: string
  ticketType: TicketType
  boringRouteDetails?: {hubId: string, fare1: number, fare2: number}
  activeMatrix: FareMatrix
}

const RouteVisualizer = ({ routeResult, stations, directFare, originId, destinationId, ticketType, boringRouteDetails, activeMatrix }: RouteVisualizerProps) => {
  const savings = directFare - routeResult.totalFare
  const hasSavings = savings > 0.01 // Floating point safety

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {hasSavings && (
        <div className="bg-green-100 border-2 border-green-500 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-2 rounded-full text-white">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-green-800 font-bold text-xl leading-none">
                You Saved: HK$ {savings.toFixed(1)}
              </p>
              <p className="text-green-600 text-sm font-medium">Extreme efficiency achieved!</p>
            </div>
          </div>
          <div className="hidden sm:block text-2xl font-black text-green-500 opacity-20">
            HACKED
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <FragmentedRouteCard 
          routeResult={routeResult} 
          stations={stations} 
          ticketType={ticketType}
          activeMatrix={activeMatrix}
        />
        
        <DirectRouteCard 
          fare={directFare} 
          origin={stations[originId]}
          destination={stations[destinationId]}
          boringRouteDetails={boringRouteDetails}
          stations={stations}
        />
      </div>
    </div>
  )
}

export default RouteVisualizer
