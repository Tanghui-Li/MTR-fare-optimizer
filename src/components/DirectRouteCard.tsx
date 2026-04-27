import { StationMap, StationMetadata } from '../types'

interface DirectRouteCardProps {
  fare: number
  origin: StationMetadata
  destination: StationMetadata
  boringRouteDetails?: {hubId: string, fare1: number, fare2: number}
  stations?: StationMap
}

const DirectRouteCard = ({ fare, origin, destination, boringRouteDetails, stations }: DirectRouteCardProps) => {
  return (
    <div className="bg-gray-100 p-6 rounded-2xl border border-gray-200 opacity-60 hover:opacity-100 transition-opacity">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs">The Boring Way</h3>
          <p className="text-gray-700 font-medium leading-tight">
            {origin.zh} → {destination.zh}
          </p>
          {boringRouteDetails && stations && (
            <div className="text-xs text-gray-500 bg-gray-200/50 p-2 rounded-lg mt-2 inline-block">
              <div className="font-semibold mb-1 border-b border-gray-300 pb-1">
                中轉一次 (1 Transfer): {stations[boringRouteDetails.hubId]?.zh}
              </div>
              <div className="flex flex-col gap-0.5">
                <span>{origin.zh} → {stations[boringRouteDetails.hubId]?.zh}: HK$ {boringRouteDetails.fare1.toFixed(1)}</span>
                <span>{stations[boringRouteDetails.hubId]?.zh} → {destination.zh}: HK$ {boringRouteDetails.fare2.toFixed(1)}</span>
              </div>
            </div>
          )}
          {!boringRouteDetails && (
            <p className="text-gray-500 text-xs">(Direct)</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-600">HK$ {fare.toFixed(1)}</p>
          <p className="text-xs text-gray-400">Normal Direct Fare</p>
        </div>
      </div>
    </div>
  )
}

export default DirectRouteCard
