import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { stationCoordinates } from '../data/stationCoordinates';
import { lineColors, lineNames } from '../data/lineColors';
import { lineSegments } from '../data/lineSegments';
import { getStationLines } from '../services/mtrApi';
import linesData from '../lines.json';
import stationsData from '../stations.json';
import { StationMap } from '../types';
import StationPopup from './StationPopup';
import BusLayer from './BusLayer';

const stations = stationsData as StationMap;
const lines = linesData as Record<string, { name: { zh: string; en: string }; stations: string[] }>;

export default function MapView() {
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
              opacity: 0.85,
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

        {/* MTR Station Markers */}
        {stationMarkers.map((marker) => {
          const isInterchange = marker.allLines.length > 1;
          return (
            <CircleMarker
              key={marker.id}
              center={[marker.lat, marker.lng]}
              radius={isInterchange ? 7 : 5}
              pathOptions={{
                color: isInterchange ? '#374151' : lineColors[marker.primaryLine] || '#666',
                fillColor: isInterchange ? '#ffffff' : lineColors[marker.primaryLine] || '#666',
                fillOpacity: isInterchange ? 1 : 0.9,
                weight: isInterchange ? 2.5 : 2,
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
