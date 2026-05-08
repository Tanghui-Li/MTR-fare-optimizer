import { useState } from 'react'
import { StationMap, StationMetadata, DetailedSegment, PathStep } from '../types'
import { lineColors, lineNames } from '../data/lineColors'
import { ArrowRight, MapPin, LogIn, ChevronDown, ChevronRight } from 'lucide-react'

interface DirectRouteCardProps {
  fare: number
  origin: StationMetadata
  destination: StationMetadata
  boringRouteDetails?: {hubId: string, fare1: number, fare2: number}
  stations?: StationMap
  detailedSegments: DetailedSegment[]
}

/** Group consecutive PathSteps by lineCode for display */
function groupByLine(path: PathStep[]): { lineCode: string; stations: string[] }[] {
  if (path.length === 0) return [];
  
  const groups: { lineCode: string; stations: string[] }[] = [];
  let currentGroup = { lineCode: path[0].lineCode, stations: [path[0].stationId] };
  
  for (let i = 1; i < path.length; i++) {
    if (path[i].lineCode === currentGroup.lineCode) {
      currentGroup.stations.push(path[i].stationId);
    } else {
      groups.push(currentGroup);
      currentGroup = { lineCode: path[i].lineCode, stations: [path[i].stationId] };
    }
  }
  groups.push(currentGroup);
  
  return groups;
}

const DirectRouteCard = ({ fare, origin, destination, boringRouteDetails, stations, detailedSegments }: DirectRouteCardProps) => {
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());

  const toggleSegment = (index: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="route-card boring-card">
      <div className="route-card-accent boring" />

      <div className="route-card-inner">
        <div className="route-card-header">
          <div>
            <h3 className="route-card-label">The Boring Way</h3>
            <div className="route-card-fare-row">
              <span className="route-card-fare boring">HK$ {fare.toFixed(1)}</span>
              <span className="route-card-fare-badge boring">Normal Direct Fare</span>
            </div>
          </div>
        </div>

        <div className="route-timeline">
          {detailedSegments.map((seg, segIdx) => {
            const isFirstSeg = segIdx === 0;
            const isLastSeg = segIdx === detailedSegments.length - 1;
            const isExpanded = expandedSegments.has(segIdx);
            const lineGroups = groupByLine(seg.path);
            const fromStation = stations?.[seg.from];
            const toStation = stations?.[seg.to];
            const totalStops = seg.path.length;
            const transferCount = lineGroups.length - 1;

            return (
              <div key={segIdx} className="route-segment">
                {/* Entry point */}
                {isFirstSeg && (
                  <div className="route-stop route-stop-terminal">
                    <div className="route-stop-dot origin" />
                    <div className="route-stop-info">
                      <h4>{fromStation?.zh || ''}</h4>
                      <p>{fromStation?.en || ''}</p>
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
                              if (gi > 0 && si === 0) return null;
                              const st = stations?.[sid];
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
                    <h4>{toStation?.zh || ''}</h4>
                    <p>{toStation?.en || ''}</p>
                    <div className="route-stop-fare">
                      <span className="route-stop-fare-label">{isLastSeg ? 'Final Exit' : 'Exit & Re-enter'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span className="route-stop-fare-amount">HK$ {seg.fare.toFixed(1)}</span>
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

export default DirectRouteCard
