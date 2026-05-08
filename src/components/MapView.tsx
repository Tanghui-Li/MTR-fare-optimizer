import { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { stationCoordinates } from '../data/stationCoordinates';
import { lineColors, lineNames } from '../data/lineColors';
import { lineSegments } from '../data/lineSegments';
import { getStationLines } from '../services/mtrApi';
import linesData from '../lines.json';
import stationsData from '../stations.json';
import { StationMap, DetailedSegment } from '../types';
import StationPopup from './StationPopup';
import BusLayer from './BusLayer';
import LRTPopup from './LRTPopup';
import lrtStationsData from '../data/lrtStations.json';

const lrtStations = lrtStationsData as Record<string, { id: string; lat: number; lng: number; zh: string; en: string }>;

const stations = stationsData as StationMap;
const lines = linesData as Record<string, { name: { zh: string; en: string }; stations: string[] }>;

interface MapViewProps {
  routeSegments?: DetailedSegment[];
  originId?: string | null;
  destinationId?: string | null;
}

/** Sub-component that handles fitBounds when route changes */
function RouteFitter({ routeSegments }: { routeSegments?: DetailedSegment[] }) {
  const map = useMap();
  const prevRouteRef = useRef<string>('');

  useEffect(() => {
    if (!routeSegments || routeSegments.length === 0) return;

    // Build a stable key so we only fit when the route actually changes
    const routeKey = routeSegments
      .map(s => s.path.map(p => p.stationId).join(','))
      .join('|');
    if (routeKey === prevRouteRef.current) return;
    prevRouteRef.current = routeKey;

    // Collect all coordinates in the route
    const coords: [number, number][] = [];
    for (const seg of routeSegments) {
      for (const step of seg.path) {
        const c = stationCoordinates[step.stationId];
        if (c) coords.push([c.lat, c.lng]);
      }
    }

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng)));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true, duration: 0.8 });
    }
  }, [routeSegments, map]);

  return null;
}

export default function MapView({ routeSegments, originId, destinationId }: MapViewProps) {
  const [showBuses, setShowBuses] = useState(true);

  // Compute which lines pass through each station
  const stationLines = useMemo(() => getStationLines(lines), []);

  // Build polylines from edge-based topology (correct branch connections)
  const edgePolylines = useMemo(() => {
    const result: { lineCode: string; from: string; to: string; positions: [number, number][] }[] = [];
    for (const [lineCode, edges] of Object.entries(lineSegments)) {
      for (const [fromId, toId] of edges) {
        const fromCoord = stationCoordinates[fromId];
        const toCoord = stationCoordinates[toId];
        if (fromCoord && toCoord) {
          result.push({
            lineCode,
            from: fromId,
            to: toId,
            positions: [
              [fromCoord.lat, fromCoord.lng],
              [toCoord.lat, toCoord.lng],
            ],
          });
        }
      }
    }
    return result;
  }, []);

  // Build route highlight polylines from DetailedSegment[]
  const routePolylines = useMemo(() => {
    if (!routeSegments || routeSegments.length === 0) return [];

    const result: {
      segIndex: number;
      lineCode: string;
      positions: [number, number][];
      isWalk: boolean;
    }[] = [];

    for (let si = 0; si < routeSegments.length; si++) {
      const seg = routeSegments[si];
      // Group consecutive steps on the same line into one polyline
      let currentLine = seg.path[0]?.lineCode || '';
      let currentPositions: [number, number][] = [];

      for (let i = 0; i < seg.path.length; i++) {
        const step = seg.path[i];
        const coord = stationCoordinates[step.stationId];
        if (!coord) continue;

        if (step.lineCode !== currentLine && currentPositions.length > 0) {
          // Line changed — push the accumulated polyline
          result.push({
            segIndex: si,
            lineCode: currentLine,
            positions: [...currentPositions],
            isWalk: currentLine === 'WALK',
          });
          // Start new polyline (include last point of previous for continuity)
          currentPositions = [currentPositions[currentPositions.length - 1]];
          currentLine = step.lineCode;
        }

        currentPositions.push([coord.lat, coord.lng]);
      }

      // Push the last accumulated polyline
      if (currentPositions.length > 1) {
        result.push({
          segIndex: si,
          lineCode: currentLine,
          positions: currentPositions,
          isWalk: currentLine === 'WALK',
        });
      }
    }

    return result;
  }, [routeSegments]);

  // Collect exit/re-enter stations (middle stops in multi-segment routes)
  const exitReenterStations = useMemo(() => {
    if (!routeSegments || routeSegments.length <= 1) return [];
    // All segment boundaries except the very first and very last station
    const result: string[] = [];
    for (let i = 0; i < routeSegments.length - 1; i++) {
      result.push(routeSegments[i].to);
    }
    return result;
  }, [routeSegments]);

  // Deduplicated station list for markers
  const stationMarkers = useMemo(() => {
    const seen = new Set<string>();
    const markers: {
      id: string;
      lat: number;
      lng: number;
      primaryLine: string;
      allLines: string[];
    }[] = [];

    for (const [lineCode, lineInfo] of Object.entries(lines)) {
      for (const stationId of lineInfo.stations) {
        if (!seen.has(stationId) && stationCoordinates[stationId]) {
          seen.add(stationId);
          const coord = stationCoordinates[stationId];
          const allLines = stationLines[stationId] || [lineCode];
          markers.push({
            id: stationId,
            lat: coord.lat,
            lng: coord.lng,
            primaryLine: allLines[0],
            allLines,
          });
        }
      }
    }
    return markers;
  }, [stationLines]);

  // Determine if a station is origin/destination/exitReenter for special rendering
  const getStationRole = (stationId: string) => {
    if (stationId === originId) return 'origin';
    if (stationId === destinationId) return 'destination';
    if (exitReenterStations.includes(stationId)) return 'exitReenter';
    return null;
  };

  return (
    <div className="map-container">
      {/* Map Controls Bar */}
      <div className="map-controls-bar">
        <div className="map-control-group">
          <label className="map-toggle">
            <input
              type="checkbox"
              checked={showBuses}
              onChange={(e) => setShowBuses(e.target.checked)}
            />
            <span className="map-toggle-slider" />
            <span className="map-toggle-label">
              <span className="bus-icon-dot" />
              港鐵巴士實時位置
            </span>
          </label>
        </div>
        <div className="map-legend">
          {Object.entries(lineColors).map(([code, color]) => (
            <span key={code} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: color }} />
              <span className="legend-text">{lineNames[code]?.zh || code}</span>
            </span>
          ))}
          {showBuses && (
            <span className="legend-item">
              <span className="legend-dot bus-legend-dot" />
              <span className="legend-text">巴士</span>
            </span>
          )}
        </div>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={[22.32, 114.17]}
        zoom={12}
        className="leaflet-map"
        zoomControl={true}
        attributionControl={true}
      >
        {/* Auto-fit to route */}
        <RouteFitter routeSegments={routeSegments} />

        {/* HK Government Basemap Tiles (Lands Department) */}
        <TileLayer
          url="https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/{z}/{x}/{y}.png"
          attribution='地圖來自 <a href="https://www.landsd.gov.hk/" target="_blank">地政總署</a>'
          maxZoom={19}
          minZoom={9}
        />

        {/* HK Government Label Layer (Chinese) */}
        <TileLayer
          url="https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/tc/WGS84/{z}/{x}/{y}.png"
          maxZoom={19}
          minZoom={9}
        />

        {/* MTR Line Polylines - edge-based for correct branch rendering */}
        {edgePolylines.map(({ lineCode, from, to, positions }) => (
          <Polyline
            key={`${lineCode}-${from}-${to}`}
            positions={positions}
            pathOptions={{
              color: lineColors[lineCode] || '#888',
              weight: 4,
              opacity: routeSegments && routeSegments.length > 0 ? 0.25 : 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
            <Tooltip sticky className="line-tooltip">
              <span style={{ color: lineColors[lineCode] || '#888', fontWeight: 600 }}>
                {lineNames[lineCode]?.zh || lineCode}
              </span>
              {' '}
              <span style={{ opacity: 0.6 }}>
                {lineNames[lineCode]?.en || ''}
              </span>
            </Tooltip>
          </Polyline>
        ))}

        {/* Route Highlight Polylines */}
        {routePolylines.map((rp, idx) => (
          <Polyline
            key={`route-${rp.segIndex}-${idx}`}
            positions={rp.positions}
            pathOptions={{
              color: rp.isWalk ? '#6b7280' : (lineColors[rp.lineCode] || '#3b82f6'),
              weight: 7,
              opacity: 0.95,
              dashArray: rp.isWalk ? '8 6' : undefined,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        {/* MTR Station Markers */}
        {stationMarkers.map((marker) => {
          const isInterchange = marker.allLines.length > 1;
          const role = getStationRole(marker.id);
          
          // Special rendering for route stations
          let radius = isInterchange ? 7 : 5;
          let color = isInterchange ? '#374151' : lineColors[marker.primaryLine] || '#666';
          let fillColor = isInterchange ? '#ffffff' : lineColors[marker.primaryLine] || '#666';
          let fillOpacity = isInterchange ? 1 : 0.9;
          let weight = isInterchange ? 2.5 : 2;

          if (role === 'origin') {
            radius = 10;
            color = '#16a34a';
            fillColor = '#22c55e';
            fillOpacity = 1;
            weight = 3;
          } else if (role === 'destination') {
            radius = 10;
            color = '#dc2626';
            fillColor = '#ef4444';
            fillOpacity = 1;
            weight = 3;
          } else if (role === 'exitReenter') {
            radius = 9;
            color = '#ea580c';
            fillColor = '#fb923c';
            fillOpacity = 1;
            weight = 3;
          }

          return (
            <CircleMarker
              key={marker.id}
              center={[marker.lat, marker.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor,
                fillOpacity,
                weight,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                className="station-tooltip"
              >
                <div>
                  <strong>{stations[marker.id]?.zh || ''}</strong>
                  <br />
                  <span style={{ opacity: 0.7, fontSize: '11px' }}>
                    {stations[marker.id]?.en || ''}
                  </span>
                  {role === 'origin' && <><br /><span style={{ color: '#16a34a', fontWeight: 600, fontSize: '11px' }}>🟢 起點</span></>}
                  {role === 'destination' && <><br /><span style={{ color: '#dc2626', fontWeight: 600, fontSize: '11px' }}>🔴 終點</span></>}
                  {role === 'exitReenter' && <><br /><span style={{ color: '#ea580c', fontWeight: 600, fontSize: '11px' }}>🟠 出閘再入閘</span></>}
                </div>
              </Tooltip>
              <StationPopup
                stationId={marker.id}
                station={stations[marker.id]}
                lines={marker.allLines}
              />
            </CircleMarker>
          );
        })}

        {/* LRT Station Markers (Static + Live Popup) */}
        {showBuses && lrtStations && Object.values(lrtStations).map((stop) => (
          <CircleMarker
            key={`lrt-${stop.id}`}
            center={[stop.lat, stop.lng]}
            radius={4}
            pathOptions={{
              color: '#94a3b8',
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -5]} className="station-tooltip">
              <div style={{ textAlign: 'center' }}>
                <strong style={{ fontSize: '12px' }}>{stop.zh}</strong>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>{stop.en}</div>
                <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>Light Rail Station</div>
              </div>
            </Tooltip>
            <LRTPopup stationId={stop.id} stationName={stop.zh} />
          </CircleMarker>
        ))}

        {/* MTR Bus Layer */}
        {showBuses && <BusLayer />}
      </MapContainer>

      {/* Data Source Attribution */}
      <div className="map-attribution">
        數據來源：
        <a href="https://data.gov.hk" target="_blank" rel="noopener noreferrer">香港政府資料一線通</a>
        {' | '}
        <a href="https://geodata.gov.hk" target="_blank" rel="noopener noreferrer">地理空間數據平台</a>
      </div>
    </div>
  );
}
