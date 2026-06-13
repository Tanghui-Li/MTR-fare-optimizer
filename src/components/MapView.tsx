import { lazy, Suspense, useMemo, useEffect, useRef, useId } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { stationCoordinates } from '../data/stationCoordinates';
import { lineColors, getLocalizedLineName } from '../data/lineColors';
import { getStationLines } from '../services/mtrApi';
import linesData from '../data/lines.json';
import stationsData from '../data/stations.json';
import { StationMap, DetailedSegment, Locale } from '../types';
import StationPopup from './StationPopup';
import accessibilityRaw from '../data/accessibilityData.json';
import { getRouteNodeCoordinate } from '../routePlanner';
import { useMapPolylines } from '../hooks/useMapPolylines';
import { buildRouteStationLookup } from '../utils/mapRouteStations';
import { t } from '../i18n';
import { getLocalizedText, getSecondaryLocalizedText } from '../data/zhHansText';

const accessibilityData = accessibilityRaw as {
  facilities: Record<string, Record<string, true | { zh: string; en: string }>>;
  categories: Record<string, { catId: string; catZh: string; catEn: string; zh: string; en: string; order: number }>;
};

const stations = stationsData as StationMap;
const lines = linesData as Record<string, { name: { zh: string; en: string }; stations: string[] }>;
const BusLayer = lazy(() => import('./BusLayer'));
const BusStopLayer = lazy(() => import('./BusStopLayer'));
const LRTStationLayer = lazy(() => import('./LRTStationLayer'));

interface MapViewProps {
  routeSegments?: DetailedSegment[];
  originId?: string | null;
  destinationId?: string | null;
  locale: Locale;
  showBuses: boolean;
  showBusStops: boolean;
  showLRT: boolean;
  setShowBuses: (v: boolean) => void;
  setShowBusStops: (v: boolean) => void;
  setShowLRT: (v: boolean) => void;
  mobileLayerControlsOpen: boolean;
  accessibilityFilter: string[][];
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
        const c = getRouteNodeCoordinate(step.stationId) || stationCoordinates[step.stationId];
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

/** Sub-component that handles map resizing gracefully */
function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        map.invalidateSize({ debounceMoveend: true });
      });
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}

export default function MapView({ 
  routeSegments, originId, destinationId, locale,
  showBuses, showBusStops, showLRT, setShowBuses, setShowBusStops, setShowLRT, mobileLayerControlsOpen,
  accessibilityFilter
}: MapViewProps) {
  const mapDescriptionId = useId();

  // Compute which lines pass through each station
  const stationLines = useMemo(() => getStationLines(lines), []);

  // Use decoupled hooks for polylines
  const { edgePolylines, routePolylines, exitReenterStations } = useMapPolylines(routeSegments);
  const routeStationLookup = useMemo(() => buildRouteStationLookup(routeSegments), [routeSegments]);

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

  // Compute highlighted stations from the same marker set that can be listed and opened.
  const highlightedStationIds = useMemo(() => {
    if (accessibilityFilter.length === 0) return null; // null = no filter active
    const result = new Set<string>();
    for (const marker of stationMarkers) {
      const facilities = accessibilityData.facilities[marker.id];
      if (!facilities) continue;
      const match = accessibilityFilter.every((clause) =>
        clause.some((code) => code in facilities)
      );
      if (match) result.add(marker.id);
    }
    return result;
  }, [accessibilityFilter, stationMarkers]);

  // Determine if a station is origin/destination/exitReenter for special rendering
  const getStationRole = (stationId: string) => {
    if (stationId === originId && stationId === destinationId) return 'originDestination';
    if (stationId === originId) return 'origin';
    if (stationId === destinationId) return 'destination';
    if (exitReenterStations.includes(stationId)) return 'exitReenter';
    if (routeStationLookup.stationIds.has(stationId)) return 'route';
    return null;
  };

  return (
    <div className="map-container" role="region" aria-label={t(locale, 'mapRegionLabel')} aria-describedby={mapDescriptionId}>
      <p id={mapDescriptionId} className="sr-only">
        {t(locale, 'mapRegionDescription')}
      </p>
      {/* Map Controls Bar */}
      <div id="map-layer-controls" className={`map-controls-bar ${mobileLayerControlsOpen ? 'mobile-open' : ''}`}>
        <div className={`map-control-group ${mobileLayerControlsOpen ? 'mobile-open' : ''}`} role="group" aria-label={t(locale, 'mapLayers')}>
          <label className="map-toggle">
            <input
              type="checkbox"
              checked={showLRT}
              aria-label={t(locale, 'mapLightRail')}
              onChange={(e) => setShowLRT(e.target.checked)}
            />
            <span className="map-toggle-slider" />
            <span className="map-toggle-label">
              <span className="lrt-icon-dot" aria-hidden="true" />
              {t(locale, 'mapLightRail')}
              <span className="map-toggle-status">{showLRT ? t(locale, 'enabled') : t(locale, 'disabled')}</span>
            </span>
          </label>
          <label className="map-toggle">
            <input
              type="checkbox"
              checked={showBusStops}
              aria-label={t(locale, 'mapBusStops')}
              onChange={(e) => setShowBusStops(e.target.checked)}
            />
            <span className="map-toggle-slider" />
            <span className="map-toggle-label">
              <span className="bus-stop-icon-dot" aria-hidden="true" />
              {t(locale, 'mapBusStops')}
              <span className="map-toggle-status">{showBusStops ? t(locale, 'enabled') : t(locale, 'disabled')}</span>
            </span>
          </label>
          <label className="map-toggle">
            <input
              type="checkbox"
              checked={showBuses}
              aria-label={t(locale, 'mapLiveBuses')}
              onChange={(e) => setShowBuses(e.target.checked)}
            />
            <span className="map-toggle-slider" />
            <span className="map-toggle-label">
              <span className="bus-icon-dot" aria-hidden="true" />
              {t(locale, 'mapLiveBuses')}
              <span className="map-toggle-status">{showBuses ? t(locale, 'enabled') : t(locale, 'disabled')}</span>
            </span>
          </label>
        </div>
        <div className="map-legend" aria-label={t(locale, 'mapLegendTitle')}>
          {Object.entries(lineColors).map(([code, color]) => (
            <span key={code} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="legend-text">{getLocalizedLineName(code, locale)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={[22.32, 114.17]}
        zoom={12}
        className="leaflet-map"
        zoomControl={true}
        attributionControl={false}
      >
        {/* Auto-fit to route */}
        <ResizeHandler />
        <RouteFitter routeSegments={routeSegments} />

        {/* HK Government Basemap Tiles (Lands Department) */}
        <TileLayer
          url="https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/{z}/{x}/{y}.png"
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
            interactive={false}
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
                {getLocalizedLineName(lineCode, locale)}
              </span>
              {' '}

            </Tooltip>
          </Polyline>
        ))}

        {/* Route Highlight Polylines */}
        {routePolylines.map((rp, idx) => (
          <Polyline
            key={`route-${rp.segIndex}-${idx}`}
            positions={rp.positions}
            interactive={false}
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
          
          // Check accessibility highlight
          const isAccHighlighted = highlightedStationIds ? highlightedStationIds.has(marker.id) : false;
          const isAccDimmed = highlightedStationIds !== null && !isAccHighlighted;

          // Special rendering for route stations
          let radius = isInterchange ? 8 : 7;
          let color = isInterchange ? '#374151' : lineColors[marker.primaryLine] || '#666';
          let fillColor = isInterchange ? '#ffffff' : lineColors[marker.primaryLine] || '#666';
          let fillOpacity = isInterchange ? 1 : 0.9;
          let opacity = 1;
          let weight = isInterchange ? 2.5 : 2;

          if (routeStationLookup.isActive && !role) {
            radius = 4;
            color = '#94a3b8';
            fillColor = '#e2e8f0';
            fillOpacity = 0.12;
            opacity = 0.28;
            weight = 1;
          } else if (role === 'originDestination') {
            radius = 12;
            color = '#0f172a';
            fillColor = '#facc15';
            fillOpacity = 1;
            weight = 3;
          } else if (role === 'origin') {
            radius = 12;
            color = '#16a34a';
            fillColor = '#22c55e';
            fillOpacity = 1;
            weight = 3;
          } else if (role === 'destination') {
            radius = 12;
            color = '#dc2626';
            fillColor = '#ef4444';
            fillOpacity = 1;
            weight = 3;
          } else if (role === 'exitReenter') {
            radius = 11;
            color = '#ea580c';
            fillColor = '#fb923c';
            fillOpacity = 1;
            weight = 3;
          } else if (role === 'route') {
            const routeLine = routeStationLookup.lineByStation.get(marker.id) || marker.primaryLine;
            radius = 8;
            color = lineColors[routeLine] || '#0f172a';
            fillColor = '#ffffff';
            fillOpacity = 1;
            weight = 3;
          }

          // Accessibility filter highlighting
          if (isAccHighlighted && !role && !routeStationLookup.isActive) {
            radius = 9;
            color = '#7c3aed';
            fillColor = '#a78bfa';
            fillOpacity = 1;
            opacity = 1;
            weight = 3;
          } else if (isAccDimmed && !role) {
            fillOpacity = Math.min(fillOpacity, 0.25);
            opacity = Math.min(opacity, 0.35);
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
                opacity,
                weight,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                className="station-tooltip"
              >
                <div>
                  <strong>{stations[marker.id] ? getLocalizedText(stations[marker.id], locale) : ''}</strong>
                  <br />
                  <span style={{ opacity: 0.7, fontSize: '11px' }}>
                    {stations[marker.id] ? getSecondaryLocalizedText(stations[marker.id], locale) : ''}
                  </span>
                  {role === 'originDestination' && <><br /><span style={{ color: '#0f172a', fontWeight: 700, fontSize: '11px' }}>◆ {t(locale, 'sameStationTitle')}</span></>}
                  {role === 'origin' && <><br /><span style={{ color: '#16a34a', fontWeight: 600, fontSize: '11px' }}>🟢 {locale === 'en' ? 'Origin' : locale === 'zh-Hans' ? '起点' : '起點'}</span></>}
                  {role === 'destination' && <><br /><span style={{ color: '#dc2626', fontWeight: 600, fontSize: '11px' }}>🔴 {locale === 'en' ? 'Destination' : locale === 'zh-Hans' ? '终点' : '終點'}</span></>}
                  {role === 'exitReenter' && <><br /><span style={{ color: '#ea580c', fontWeight: 600, fontSize: '11px' }}>🟠 {locale === 'en' ? 'Exit & Re-enter' : locale === 'zh-Hans' ? '出闸再入闸' : '出閘再入閘'}</span></>}
                  {isAccHighlighted && <><br /><span style={{ color: '#6d28d9', fontWeight: 600, fontSize: '11px' }}>◆ {t(locale, 'accessibilityFilterMatch')}</span></>}
                </div>
              </Tooltip>
              <StationPopup
                stationId={marker.id}
                station={stations[marker.id]}
                lines={marker.allLines}
                locale={locale}
              />
            </CircleMarker>
          );
        })}

        <Suspense fallback={<div className="map-layer-loading" role="status">{t(locale, 'loading')}</div>}>
          {/* MTR Bus Layer (live vehicles) */}
          {showBuses && <BusLayer locale={locale} />}

          {/* MTR Bus Stop Locations */}
          {showBusStops && (
            <BusStopLayer
              locale={locale}
              routeStationIds={routeStationLookup.stationIds}
              isRouteActive={routeStationLookup.isActive}
            />
          )}

          {/* LRT Station Markers (Static + Live Popup) */}
          {showLRT && (
            <LRTStationLayer
              locale={locale}
              routeStationIds={routeStationLookup.stationIds}
              isRouteActive={routeStationLookup.isActive}
            />
          )}
        </Suspense>

      </MapContainer>

    </div>
  );
}
