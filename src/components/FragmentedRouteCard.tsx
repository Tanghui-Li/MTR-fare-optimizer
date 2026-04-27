import { RouteResult, StationMap, TicketType, FareMatrix } from '../types'
import { ArrowRight, MapPin, Zap, LogIn } from 'lucide-react'

interface FragmentedRouteCardProps {
  routeResult: RouteResult
  stations: StationMap
  ticketType: TicketType
  activeMatrix: FareMatrix
}

// Stations that should be collapsed into one line if adjacent
const COLLAPSE_GROUPS: { [id: string]: string } = {
  '1': '39', // Central <-> Hong Kong
  '39': '1',
  '3': '80', // TST <-> East TST
  '80': '3'
}

const FragmentedRouteCard = ({ routeResult, stations, ticketType, activeMatrix }: FragmentedRouteCardProps) => {
  // Pre-process route to collapse walking interchanges for display
  const displayRoute: { id: string; mergedWith?: string }[] = []
  
  for (let i = 0; i < routeResult.route.length; i++) {
    const currentId = routeResult.route[i]
    const nextId = routeResult.route[i + 1]
    
    if (nextId && COLLAPSE_GROUPS[currentId] === nextId) {
      displayRoute.push({ id: currentId, mergedWith: nextId })
      i++ // Skip next
    } else {
      displayRoute.push({ id: currentId })
    }
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-gray-900 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4">
        <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs mb-1">Optimized Route</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-gray-900">HK$ {routeResult.totalFare.toFixed(1)}</span>
            <span className="text-green-600 font-bold uppercase tracking-widest text-xs">Best {ticketType} Price</span>
          </div>
        </div>

        <div className="relative pl-8 border-l-2 border-dashed border-gray-200 space-y-10">
          {displayRoute.map((item, index) => {
            const isLast = index === displayRoute.length - 1
            const isFirst = index === 0
            const station = stations[item.id]
            const mergedStation = item.mergedWith ? stations[item.mergedWith] : null
            
            // Find the fare for the segment ending at this line
            // We need to find the original index in routeResult.route
            const originalIndex = routeResult.route.indexOf(item.id)
            let prevSegmentFare = 0
            if (originalIndex > 0) {
              const prevId = routeResult.route[originalIndex - 1]
              prevSegmentFare = activeMatrix[prevId]?.[item.id] || 0
            }

            return (
              <div key={index} className="relative">
                {/* Timeline Dot */}
                <div className={`absolute -left-[41px] w-5 h-5 rounded-full border-4 border-white shadow-md ${
                  isFirst || isLast ? 'bg-gray-900' : 'bg-green-500'
                }`} />
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 leading-none">
                      {station.zh}{mergedStation ? ` / ${mergedStation.zh}` : ''}
                    </h4>
                    <p className="text-gray-500 text-sm font-medium">
                      {station.en}{mergedStation ? ` / ${mergedStation.en}` : ''}
                    </p>
                    
                    {isFirst && (
                      <div className="mt-2 flex items-center gap-1 text-gray-400 text-[10px] font-black uppercase tracking-tighter">
                        <LogIn className="w-3 h-3" />
                        Enter System
                      </div>
                    )}
                  </div>
                  
                  {!isFirst && (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                        <span className="text-[10px] uppercase tracking-wider">{isLast ? 'Final Exit' : 'Exit & Re-enter'}</span>
                        <ArrowRight className="w-4 h-4" />
                        <div className="flex flex-col items-end">
                          <span>HK$ {prevSegmentFare.toFixed(1)}</span>
                          {ticketType === 'octopus' && prevSegmentFare === 0 && (
                            <span className="text-[8px] text-blue-500 font-black uppercase tracking-tighter leading-none mt-1">
                              免費港鐵接駁服務 🎁
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isLast && (
                  <div className="mt-2 inline-flex items-center gap-2 text-gray-400 text-xs font-black uppercase tracking-wider">
                    <MapPin className="w-3 h-3" />
                    Trip Complete
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default FragmentedRouteCard
