import { useState } from 'react'
import { RouteResult, StationMap, TicketType, FareMatrix, DetailedSegment, PathStep } from '../types'
import { lineColors, lineNames } from '../data/lineColors'
import { ArrowRight, MapPin, Zap, LogIn, ChevronDown, ChevronRight } from 'lucide-react'

interface FragmentedRouteCardProps {
  routeResult: RouteResult
  stations: StationMap
  ticketType: TicketType
  activeMatrix: FareMatrix
  detailedSegments: DetailedSegment[]
  customLabel?: string
}

// Stations that should be collapsed into one line if adjacent
const COLLAPSE_GROUPS: { [id: string]: string } = {
  '1': '39', // Central <-> Hong Kong
  '39': '1',
  '3': '80', // TST <-> East TST
  '80': '3'
}

/** Group consecutive PathSteps by lineCode for display */
function groupByLine(path: PathStep[]): { lineCode: string; stations: string[] }[] {
  if (path.length === 0) return [];
  
  const groups: { lineCode: string; stations: string[] }[] = [];
  let currentGroup = { lineCode: path[0].lineCode, stations: [path[0].stationId] };
  
  for (let i = 1; i < path.length; i++) {
    const step = path[i];
    if (step.lineCode === currentGroup.lineCode) {
      currentGroup.stations.push(step.stationId);
    } else {
      // Line changed!
      // The current station 'step.stationId' is the first station of the NEW line,
      // but it's also where the OLD line conceptually ends for the user.
      // However, to avoid drawing lines that shouldn't exist, we must be careful.
      
      // If it's a walk, we definitely want to start a new group.
      groups.push(currentGroup);
      
      // Start new group with the SAME station as the end of the previous one
      // if they are at the same physical location (or it's a transfer)
      // Actually, in our BFS, 'step.stationId' is already the station we just reached.
      const lastStationId = currentGroup.stations[currentGroup.stations.length - 1];
      currentGroup = { lineCode: step.lineCode, stations: [lastStationId, step.stationId] };
    }
  }
  groups.push(currentGroup);
  
  return groups;
}

const FragmentedRouteCard = ({ routeResult, stations, ticketType, activeMatrix, detailedSegments, customLabel }: FragmentedRouteCardProps) => {
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());

  const toggleSegment = (index: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Pre-process route to collapse walking interchanges for the header display
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
    <div className="route-card optimized-card">
      <div className="route-card-accent" />

      <div className="route-card-inner">
        <div className="route-card-header">
          <div>
            <h3 className="route-card-label">{customLabel || 'Optimized Route'}</h3>
            <div className="route-card-fare-row">
              <span className="route-card-fare">HK$ {routeResult.totalFare.toFixed(1)}</span>
              <span className="route-card-fare-badge">Best {ticketType} Price</span>
            </div>
          </div>
          <Zap className="w-7 h-7 text-yellow-400 fill-yellow-400" />
        </div>

        <div className="route-timeline">
          {detailedSegments.map((seg, segIdx) => {
            const isFirstSeg = segIdx === 0;
            const isLastSeg = segIdx === detailedSegments.length - 1;
            const isExpanded = expandedSegments.has(segIdx);
            const lineGroups = groupByLine(seg.path);
            const fromStation = stations[seg.from];
            const toStation = stations[seg.to];
            const mergedFrom = COLLAPSE_GROUPS[seg.from];
            const mergedTo = COLLAPSE_GROUPS[seg.to];
            const totalStops = seg.path.length;
            const transferCount = lineGroups.length - 1;

            return (
              <div key={segIdx} className="route-segment">
                {/* Entry point */}
                {isFirstSeg && (
                  <div className="route-stop route-stop-terminal">
                    <div className="route-stop-dot origin" />
                    <div className="route-stop-info">
                      <h4>{fromStation?.zh}{mergedFrom && stations[mergedFrom] ? ` / ${stations[mergedFrom].zh}` : ''}</h4>
                      <p>{fromStation?.en}{mergedFrom && stations[mergedFrom] ? ` / ${stations[mergedFrom].en}` : ''}</p>
                      <div className="route-stop-action enter">
                        <LogIn className="w-3 h-3" />
                        Enter System
                      </div>
                    </div>
                  </div>
                )}

                {/* Segment details (expandable) */}
                <div className="route-segment-body">
                  <button
                    className="route-segment-summary"
                    onClick={() => toggleSegment(segIdx)}
                  >
                    <div className="route-segment-lines">
                      {lineGroups.map((g, gi) => (
                        <span
                          key={gi}
                          className="route-segment-line-tag"
                          style={{ backgroundColor: lineColors[g.lineCode] || '#666' }}
                        >
                          {lineNames[g.lineCode]?.zh || g.lineCode}
                        </span>
                      ))}
                    </div>
                    <span className="route-segment-info-text">
                      {totalStops} 站 · {transferCount > 0 ? `${transferCount} 次換乘` : '直達'}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Expanded path detail */}
                  {isExpanded && (
                    <div className="route-segment-detail">
                      {lineGroups.map((group, gi) => (
                        <div key={gi} className="route-line-group">
                          <div className="route-line-group-header">
                            <span
                              className="route-line-color-bar"
                              style={{ backgroundColor: lineColors[group.lineCode] || '#666' }}
                            />
                            <span className="route-line-group-name">
                              {lineNames[group.lineCode]?.zh || group.lineCode}
                              <span className="route-line-group-name-en">
                                {lineNames[group.lineCode]?.en || ''}
                              </span>
                            </span>
                          </div>
                          <div className="route-line-stations">
                            {group.stations.map((sid, si) => {
                              const st = stations[sid];
                              if (!st) return null;
                              return (
                                <div key={`${sid}-${si}`} className="route-line-station">
                                  <span
                                    className="route-line-station-dot"
                                    style={{ borderColor: lineColors[group.lineCode] || '#666' }}
                                  />
                                  <span className="route-line-station-name">
                                    {st.zh}
                                    <span className="route-line-station-en">{st.en}</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exit point */}
                <div className={`route-stop ${isLastSeg ? 'route-stop-terminal' : 'route-stop-transfer'}`}>
                  <div className={`route-stop-dot ${isLastSeg ? 'destination' : 'exit-reenter'}`} />
                  <div className="route-stop-info">
                    <h4>{toStation?.zh}{mergedTo && stations[mergedTo] ? ` / ${stations[mergedTo].zh}` : ''}</h4>
                    <p>{toStation?.en}{mergedTo && stations[mergedTo] ? ` / ${stations[mergedTo].en}` : ''}</p>
                    <div className="route-stop-fare">
                      <span className="route-stop-fare-label">{isLastSeg ? 'Final Exit' : 'Exit & Re-enter'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span className="route-stop-fare-amount">HK$ {seg.fare.toFixed(1)}</span>
                      {ticketType === 'octopus' && seg.fare === 0 && (
                        <span className="route-stop-free-badge">免費港鐵接駁服務 🎁</span>
                      )}
                    </div>
                    {isLastSeg && (
                      <div className="route-stop-action complete">
                        <MapPin className="w-3 h-3" />
                        Trip Complete
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}

export default FragmentedRouteCard
