import { RouteResult, StationMap, TicketType, FareMatrix, DetailedSegment } from '../types'
import FragmentedRouteCard from './FragmentedRouteCard'
import DirectRouteCard from './DirectRouteCard'
import { TrendingDown } from 'lucide-react'

type RouteMode = 'optimized' | 'boring';

interface RouteVisualizerProps {
  routeResult: RouteResult
  stations: StationMap
  directFare: number
  originId: string
  destinationId: string
  ticketType: TicketType
  boringRouteDetails?: {hubId: string, fare1: number, fare2: number}
  activeMatrix: FareMatrix
  routeMode: RouteMode
  onRouteModeChange: (mode: RouteMode) => void
  optimizedSegments: DetailedSegment[]
  boringSegments: DetailedSegment[]
}

const RouteVisualizer = ({
  routeResult,
  stations,
  directFare,
  originId,
  destinationId,
  ticketType,
  boringRouteDetails,
  activeMatrix,
  routeMode,
  onRouteModeChange,
  optimizedSegments,
  boringSegments,
}: RouteVisualizerProps) => {
  const savings = directFare - routeResult.totalFare
  const hasSavings = savings > 0.01 // Floating point safety

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!hasSavings ? (
        <div className="no-savings-banner">
          <div className="no-savings-icon">✅</div>
          <div>
            <h3 className="no-savings-title">此行程無需額外出閘</h3>
            <p className="no-savings-sub">
              直接乘車即可享受最低票價 HK$ {routeResult.totalFare.toFixed(1)}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Savings Banner */}
          {routeMode === 'optimized' && (
            <div className="savings-banner">
              <div className="savings-banner-left">
                <div className="savings-icon">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="savings-amount">
                    You Saved: HK$ {savings.toFixed(1)}
                  </p>
                  <p className="savings-sub">Extreme efficiency achieved!</p>
                </div>
              </div>
              <div className="savings-watermark">HACKED</div>
            </div>
          )}

          {/* Route Mode Toggle */}
          <div className="route-mode-toggle">
            <button
              className={`route-mode-btn ${routeMode === 'optimized' ? 'route-mode-btn-active optimized' : ''}`}
              onClick={() => onRouteModeChange('optimized')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              Optimized Route
              <span className="route-mode-fare">HK$ {routeResult.totalFare.toFixed(1)}</span>
            </button>
            <button
              className={`route-mode-btn ${routeMode === 'boring' ? 'route-mode-btn-active boring' : ''}`}
              onClick={() => onRouteModeChange('boring')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              The Boring Way
              <span className="route-mode-fare">HK$ {directFare.toFixed(1)}</span>
            </button>
          </div>
        </>
      )}

      {/* Route Card */}
      {(!hasSavings || routeMode === 'optimized') ? (
        <FragmentedRouteCard 
          routeResult={routeResult} 
          stations={stations} 
          ticketType={ticketType}
          activeMatrix={activeMatrix}
          detailedSegments={optimizedSegments}
          customLabel={!hasSavings ? 'Standard Best Route' : undefined}
        />
      ) : (
        <DirectRouteCard 
          fare={directFare} 
          origin={stations[originId]}
          destination={stations[destinationId]}
          boringRouteDetails={boringRouteDetails}
          stations={stations}
          detailedSegments={boringSegments}
        />
      )}
    </div>
  )
}

export default RouteVisualizer
