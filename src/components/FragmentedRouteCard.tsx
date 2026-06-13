import { useEffect, useId, useState } from 'react'
import { RouteResult, StationMap, TicketType, DetailedSegment, PathStep, Locale } from '../types'
import { lineColors, getLocalizedLineName, getLineTextColor } from '../data/lineColors'
import { ArrowRight, MapPin, Zap, LogIn, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, t } from '../i18n'
import { getLocalizedText } from '../data/zhHansText'

interface FragmentedRouteCardProps {
  routeResult: RouteResult
  stations: StationMap
  ticketType: TicketType
  detailedSegments: DetailedSegment[]
  customLabel?: string
  locale: Locale
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
  if (path.length === 1) {
    return [{ lineCode: path[0].lineCode, stations: [path[0].stationId] }];
  }

  const groups: { lineCode: string; stations: string[] }[] = [];
  let currentLine = path[0].lineCode;
  let currentStations = [path[0].stationId, path[1].stationId];

  for (let i = 1; i < path.length - 1; i++) {
    const edgeLine = path[i].lineCode;
    const nextStation = path[i + 1].stationId;

    if (edgeLine === currentLine) {
      currentStations.push(nextStation);
    } else {
      groups.push({ lineCode: currentLine, stations: currentStations });
      // Start the new line group from the transfer station itself.
      currentLine = edgeLine;
      currentStations = [path[i].stationId, nextStation];
    }
  }

  groups.push({ lineCode: currentLine, stations: currentStations });
  
  return groups;
}

const FragmentedRouteCard = ({ routeResult, stations, ticketType, detailedSegments, customLabel, locale }: FragmentedRouteCardProps) => {
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const detailIdPrefix = useId();

  useEffect(() => {
    setExpandedSegments(new Set(detailedSegments.map((_, idx) => idx)));
  }, [detailedSegments]);

  const displayName = (station?: { zh: string; en: string }) => {
    if (!station) return '';
    return getLocalizedText(station, locale);
  };

  const getStationTypeLabel = (stationId: string) => {
    if (stationId.startsWith('lrt:')) return t(locale, 'lrtStation');
    if (stationId.startsWith('bus:')) return t(locale, 'busStation');
    return t(locale, 'mtrStation');
  };

  const toggleSegment = (index: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="route-card optimized-card">
      <div className="route-card-accent" />

      <div className="route-card-inner">
        <div className="route-card-header">
          <div>
            <h3 className="route-card-label">{customLabel || t(locale, 'optimizedRoute')}</h3>
            <div className="route-card-fare-row">
              <span className="route-card-fare">{formatCurrency(routeResult.totalFare)}</span>
              <span className="route-card-fare-badge">{t(locale, 'bestPrice')}</span>
            </div>
          </div>
          <Zap className="w-7 h-7 text-yellow-400 fill-yellow-400" />
        </div>

        <div className="route-timeline">
          {detailedSegments.map((seg, segIdx) => {
            const isFirstSeg = segIdx === 0;
            const isLastSeg = segIdx === detailedSegments.length - 1;
            const prevSeg = segIdx > 0 ? detailedSegments[segIdx - 1] : null;
            const isExpanded = expandedSegments.has(segIdx);
            const lineGroups = groupByLine(seg.path);
            const displayLineGroups = lineGroups.filter((group) => group.lineCode !== 'TRANSFER');
            const fromStation = stations[seg.from];
            const toStation = stations[seg.to];
            const mergedFrom = COLLAPSE_GROUPS[seg.from];
            const mergedTo = COLLAPSE_GROUPS[seg.to];
            const totalStops = seg.path.length;
            const transferCount = Math.max(displayLineGroups.length - 1, 0);
            const showTransferNote = Boolean(prevSeg && prevSeg.to !== seg.from);
            const transferFrom = prevSeg ? stations[prevSeg.to] : undefined;
            const detailId = `${detailIdPrefix}-segment-${segIdx}`;
            const lineSummary = displayLineGroups.map((group) => getLocalizedLineName(group.lineCode, locale)).join(', ') || t(locale, 'transferNote');
            const segmentSummaryLabel = `${isExpanded ? t(locale, 'collapseSegmentDetails') : t(locale, 'expandSegmentDetails')}: ${lineSummary}, ${totalStops} ${t(locale, 'routeCount')} · ${transferCount > 0 ? `${transferCount} ${t(locale, 'transferCount')}` : t(locale, 'direct')}`;

            return (
              <div key={segIdx} className="route-segment">
                {/* Entry point */}
                {isFirstSeg && (
                  <div className="route-stop route-stop-terminal">
                    <div className="route-stop-dot origin" />
                    <div className="route-stop-info">
                      <h4>
                        {displayName(fromStation)}{mergedFrom && stations[mergedFrom] ? ` / ${displayName(stations[mergedFrom])}` : ''}
                        <span className="route-stop-type">({getStationTypeLabel(seg.from)})</span>
                        <span className="route-stop-role-label">{t(locale, 'startingPoint')}</span>
                      </h4>
                      <div className="route-stop-action enter">
                        <LogIn className="w-3 h-3" />
                        {t(locale, 'enterSystem')}
                      </div>
                    </div>
                  </div>
                )}

                {!isFirstSeg && (
                  <>
                    {showTransferNote && transferFrom && fromStation && (
                      <div className="route-transfer-note">
                        {t(locale, 'transferNote')}: {displayName(transferFrom)}{' -> '}{displayName(fromStation)}
                      </div>
                    )}
                    <div className="route-stop route-stop-transfer">
                      <div className="route-stop-dot exit-reenter" />
                      <div className="route-stop-info">
                        <h4>
                          {displayName(fromStation)}{mergedFrom && stations[mergedFrom] ? ` / ${displayName(stations[mergedFrom])}` : ''}
                          <span className="route-stop-type">({getStationTypeLabel(seg.from)})</span>
                          <span className="route-stop-role-label">{t(locale, 'exitReenter')}</span>
                        </h4>
                        <div className="route-stop-action enter">
                          <LogIn className="w-3 h-3" />
                          {t(locale, 'enterGate')}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Segment details (expandable) */}
                <div className="route-segment-body">
                  <button
                    type="button"
                    className="route-segment-summary"
                    onClick={() => toggleSegment(segIdx)}
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                    aria-label={segmentSummaryLabel}
                  >
                    <div className="route-segment-lines">
                      {displayLineGroups.map((g, gi) => (
                        <span
                          key={gi}
                          className="route-segment-line-tag"
                          style={{
                            backgroundColor: lineColors[g.lineCode] || '#666',
                            color: getLineTextColor(lineColors[g.lineCode] || '#666'),
                          }}
                        >
                          {getLocalizedLineName(g.lineCode, locale)}
                        </span>
                      ))}
                    </div>
                    <span className="route-segment-info-text">
                      {totalStops} {t(locale, 'routeCount')} · {transferCount > 0 ? `${transferCount} ${t(locale, 'transferCount')}` : t(locale, 'direct')}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Expanded path detail */}
                  {isExpanded && (
                    <div id={detailId} className="route-segment-detail">
                      {displayLineGroups.map((group, gi) => (
                        <div key={gi} className="route-line-group">
                          <div className="route-line-group-header">
                            <span
                              className="route-line-color-bar"
                              style={{ backgroundColor: lineColors[group.lineCode] || '#666' }}
                            />
                            <span className="route-line-group-name">
                              {getLocalizedLineName(group.lineCode, locale)}
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
                                    {displayName(st)}
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
                    <h4>
                      {displayName(toStation)}{mergedTo && stations[mergedTo] ? ` / ${displayName(stations[mergedTo])}` : ''}
                      <span className="route-stop-type">({getStationTypeLabel(seg.to)})</span>
                      <span className="route-stop-role-label">{isLastSeg ? t(locale, 'finalDestination') : t(locale, 'exitReenter')}</span>
                    </h4>
                    <div className="route-stop-fare">
                      <span className="route-stop-fare-label">{isLastSeg ? t(locale, 'finalExit') : t(locale, 'exitGate')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span className="route-stop-fare-amount">{formatCurrency(seg.fare)}</span>
                      {ticketType === 'octopus' && seg.fare === 0 && (
                        <span className="route-stop-free-badge">{t(locale, 'aelFreeShuttle')} 🎁</span>
                      )}
                    </div>
                    {isLastSeg && (
                      <div className="route-stop-action complete">
                        <MapPin className="w-3 h-3" />
                        {t(locale, 'tripComplete')}
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
