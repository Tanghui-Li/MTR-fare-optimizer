import { lazy, Suspense, useMemo, useEffect, useRef, useState, useId } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { stationCoordinates } from '../data/stationCoordinates';
import { lineColors, getLocalizedLineName } from '../data/lineColors';
import { getStationLines } from '../services/mtrApi';
import linesData from '../data/lines.json';
import stationsData from '../data/stations.json';
import { StationMap, DetailedSegment, Locale } from '../types';
import StationPopup, { StationDetails } from './StationPopup';
import { LRTDetails } from './LRTPopup';
import accessibilityRaw from '../data/accessibilityData.json';
import lrtStationsData from '../data/lrtStations.json';
import { busStopLocations } from '../data/unifiedNetwork';
import { getRouteNodeCoordinate } from '../routePlanner';
import { useMapPolylines } from '../hooks/useMapPolylines';
import { t } from '../i18n';
import { getLocalizedText, getSecondaryLocalizedText } from '../data/zhHansText';

const accessibilityData = accessibilityRaw as {
  facilities: Record<string, Record<string, true | { zh: string; en: string }>>;
  categories: Record<string, { catId: string; catZh: string; catEn: string; zh: string; en: string; order: number }>;
};

const stations = stationsData as StationMap;
const lines = linesData as Record<string, { name: { zh: string; en: string }; stations: string[] }>;
const lrtStations = lrtStationsData as Record<string, { id: string; lat: number; lng: number; zh: string; en: string }>;
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

interface StationMarker {
  id: string;
  lat: number;
  lng: number;
  primaryLine: string;
  allLines: string[];
}

type MapSelectedItem =
  | { kind: 'mtr'; stationId: string }
  | { kind: 'busStop'; title: string; detail: string; routes: string[] }
  | { kind: 'lrt'; stationId: string; stationName: string; detail: string };

function getStationRoleLabel(role: string | null, locale: Locale) {
  if (role === 'originDestination') return t(locale, 'sameStationTitle');
  if (role === 'origin') return t(locale, 'startingPoint');
  if (role === 'destination') return t(locale, 'finalDestination');
  if (role === 'exitReenter') return t(locale, 'exitReenter');
  return '';
}

function MapAccessPanel({
  stationMarkers,
  routeKeyStationIds,
  exitReenterStations,
  originId,
  destinationId,
  locale,
  showBusStops,
  showLRT,
  highlightedStationIds,
}: {
  stationMarkers: StationMarker[];
  routeKeyStationIds: string[];
  exitReenterStations: string[];
  originId?: string | null;
  destinationId?: string | null;
  locale: Locale;
  showBusStops: boolean;
  showLRT: boolean;
  highlightedStationIds: Set<string> | null;
}) {
  const map = useMap();
  const [selectedItem, setSelectedItem] = useState<MapSelectedItem | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobilePanelId = useId();
  const mobileTitleId = useId();
  const stationMarkerById = useMemo(() => new Map(stationMarkers.map((marker) => [marker.id, marker])), [stationMarkers]);
  const lrtStops = useMemo(() => Object.values(lrtStations), []);
  const matchedStationIds = useMemo(() => {
    if (!highlightedStationIds) return [];
    return stationMarkers
      .filter((marker) => highlightedStationIds.has(marker.id))
      .map((marker) => marker.id);
  }, [highlightedStationIds, stationMarkers]);

  const getStationRole = (stationId: string) => {
    if (stationId === originId && stationId === destinationId) return 'originDestination';
    if (stationId === originId) return 'origin';
    if (stationId === destinationId) return 'destination';
    if (exitReenterStations.includes(stationId)) return 'exitReenter';
    return null;
  };

  const focusMapItem = (lat: number, lng: number, item: MapSelectedItem) => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
    setSelectedItem(item);
  };

  const closeMobilePanel = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => mobileToggleRef.current?.focus());
  };

  const renderSelectedDetails = () => {
    if (!selectedItem) return null;

    if (selectedItem.kind === 'mtr') {
      const marker = stationMarkerById.get(selectedItem.stationId);
      const station = stations[selectedItem.stationId];
      if (!marker || !station) return null;
      return (
        <div className="map-access-selected map-access-selected-detail" role="region" aria-live="polite" aria-label={t(locale, 'mapItemSelected')}>
          <StationDetails
            stationId={selectedItem.stationId}
            station={station}
            lines={marker.allLines}
            locale={locale}
            isActive
          />
        </div>
      );
    }

    if (selectedItem.kind === 'lrt') {
      return (
        <div className="map-access-selected map-access-selected-detail" role="region" aria-live="polite" aria-label={t(locale, 'mapItemSelected')}>
          <LRTDetails
            stationId={selectedItem.stationId}
            stationName={selectedItem.stationName}
            locale={locale}
            isActive
          />
        </div>
      );
    }

    return (
      <div className="map-access-selected" role="status" aria-live="polite">
        <strong>{t(locale, 'mapItemSelected')}: {selectedItem.title}</strong>
        <span>{selectedItem.detail}</span>
        <div className="bus-stop-tooltip-routes">
          {selectedItem.routes.map(route => (
            <span key={route} className="bus-stop-route-badge">{route}</span>
          ))}
        </div>
      </div>
    );
  };

  const renderAccessSections = () => (
    <>
      {routeKeyStationIds.length > 0 && (
        <section className="map-access-section" aria-label={t(locale, 'routeKeyStops')}>
          <h3>{t(locale, 'routeKeyStops')}</h3>
          <div className="map-access-list route-key-list">
            {routeKeyStationIds.map((stationId) => renderStationButton(stationId, true))}
          </div>
        </section>
      )}

      {highlightedStationIds && (
        <section className="map-access-section" aria-label={t(locale, 'accessibilityMatchedStations')}>
          <h3>{t(locale, 'accessibilityMatchedStations')}</h3>
          <div className="map-access-list">
            {matchedStationIds.length > 0 ? (
              matchedStationIds.map((stationId) => renderStationButton(stationId))
            ) : (
              <div className="map-access-empty">{t(locale, 'accessibilityFilterNoMatches')}</div>
            )}
          </div>
        </section>
      )}

      <section className="map-access-section" aria-label={t(locale, 'mtrStation')}>
        <h3>{t(locale, 'mtrStation')}</h3>
        <div className="map-access-list">
          {stationMarkers.map((marker) => renderStationButton(marker.id))}
        </div>
      </section>

      {showBusStops && (
        <section className="map-access-section" aria-label={t(locale, 'mapBusStops')}>
          <h3>{t(locale, 'mapBusStops')}</h3>
          <div className="map-access-list">
            {busStopLocations.map((stop) => {
              const name = getLocalizedText(stop, locale);
              const routeText = stop.routes.join(', ');
              const detail = `${t(locale, 'mapBusStops')} · ${routeText}`;
              return (
                <button
                  key={`${stop.id}-${stop.lat}-${stop.lng}`}
                  type="button"
                  className="map-access-item"
                  aria-label={`${t(locale, 'openMapItem')}: ${name}, ${detail}`}
                  onClick={() => focusMapItem(stop.lat, stop.lng, { kind: 'busStop', title: name, detail, routes: stop.routes })}
                >
                  <span className="map-access-shape square" aria-hidden="true">■</span>
                  <span className="map-access-item-text">
                    <span className="map-access-item-name">{name}</span>
                    <span className="map-access-item-meta">{routeText}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showLRT && (
        <section className="map-access-section" aria-label={t(locale, 'mapLightRail')}>
          <h3>{t(locale, 'mapLightRail')}</h3>
          <div className="map-access-list">
            {lrtStops.map((stop) => {
              const name = getLocalizedText(stop, locale);
              const secondaryName = getSecondaryLocalizedText(stop, locale);
              const detail = [t(locale, 'lrtStation'), secondaryName].filter(Boolean).join(' · ');
              return (
                <button
                  key={`access-lrt-${stop.id}`}
                  type="button"
                  className="map-access-item"
                  aria-label={`${t(locale, 'openMapItem')}: ${name}, ${detail}`}
                  onClick={() => focusMapItem(stop.lat, stop.lng, { kind: 'lrt', stationId: stop.id, stationName: name, detail })}
                >
                  <span className="map-access-shape diamond" aria-hidden="true">◆</span>
                  <span className="map-access-item-text">
                    <span className="map-access-item-name">{name}</span>
                    <span className="map-access-item-meta">{detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );

  const renderStationButton = (stationId: string, compact = false) => {
    const marker = stationMarkerById.get(stationId);
    const station = stations[stationId];
    if (!marker || !station) return null;

    const name = getLocalizedText(station, locale);
    const secondaryName = getSecondaryLocalizedText(station, locale);
    const roleLabel = getStationRoleLabel(getStationRole(stationId), locale);
    const filterMatchLabel = highlightedStationIds?.has(stationId) ? t(locale, 'accessibilityFilterMatch') : '';
    const lineText = marker.allLines.map((line) => getLocalizedLineName(line, locale)).join(', ');
    const detail = [roleLabel, filterMatchLabel, lineText, secondaryName].filter(Boolean).join(' · ');

    return (
      <button
        key={stationId}
        type="button"
        className="map-access-item"
        aria-label={`${t(locale, 'openMapItem')}: ${name}${detail ? `, ${detail}` : ''}`}
        onClick={() => focusMapItem(marker.lat, marker.lng, { kind: 'mtr', stationId })}
      >
        <span className={`map-access-shape ${roleLabel || filterMatchLabel ? 'important' : ''}`} aria-hidden="true">
          {roleLabel || filterMatchLabel ? '◆' : '●'}
        </span>
        <span className="map-access-item-text">
          <span className="map-access-item-name">{name}</span>
          {!compact && <span className="map-access-item-meta">{detail || t(locale, 'mtrStation')}</span>}
        </span>
      </button>
    );
  };

  return (
    <>
      <details className="map-access-panel">
        <summary>{t(locale, 'accessibleMapItems')}</summary>
        {renderSelectedDetails()}
        {renderAccessSections()}
      </details>

      <div className={`mobile-map-access-panel ${mobileOpen ? 'open' : ''}`}>
        <button
          ref={mobileToggleRef}
          type="button"
          className="mobile-map-access-toggle"
          aria-expanded={mobileOpen}
          aria-controls={mobilePanelId}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {t(locale, 'accessibleMapItems')}
        </button>
        {mobileOpen && (
          <div
            id={mobilePanelId}
            className="mobile-map-access-drawer"
            role="dialog"
            aria-modal="false"
            aria-labelledby={mobileTitleId}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeMobilePanel();
              }
            }}
          >
            <div className="mobile-map-access-header">
              <h2 id={mobileTitleId}>{t(locale, 'accessibleMapItems')}</h2>
              <button type="button" onClick={closeMobilePanel}>
                {t(locale, 'closePanel')}
              </button>
            </div>
            {renderSelectedDetails()}
            {renderAccessSections()}
          </div>
        )}
      </div>
    </>
  );
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

  // Compute highlighted stations based on accessibility filter (CNF)
  const highlightedStationIds = useMemo(() => {
    if (accessibilityFilter.length === 0) return null; // null = no filter active
    const result = new Set<string>();
    for (const [sid, facs] of Object.entries(accessibilityData.facilities)) {
      // Check CNF: every clause must have at least one matching facility
      const match = accessibilityFilter.every(clause =>
        clause.some(code => code in facs)
      );
      if (match) result.add(sid);
    }
    return result;
  }, [accessibilityFilter]);

  // Compute which lines pass through each station
  const stationLines = useMemo(() => getStationLines(lines), []);

  // Use decoupled hooks for polylines
  const { edgePolylines, routePolylines, exitReenterStations } = useMapPolylines(routeSegments);

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
    if (stationId === originId && stationId === destinationId) return 'originDestination';
    if (stationId === originId) return 'origin';
    if (stationId === destinationId) return 'destination';
    if (exitReenterStations.includes(stationId)) return 'exitReenter';
    return null;
  };

  const routeKeyStationIds = useMemo(() => {
    const ids = [
      originId,
      ...exitReenterStations,
      destinationId,
    ].filter((id): id is string => Boolean(id));
    return Array.from(new Set(ids));
  }, [originId, destinationId, exitReenterStations]);

  return (
    <div className="map-container">
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
          let radius = isInterchange ? 7 : 5;
          let color = isInterchange ? '#374151' : lineColors[marker.primaryLine] || '#666';
          let fillColor = isInterchange ? '#ffffff' : lineColors[marker.primaryLine] || '#666';
          let fillOpacity = isInterchange ? 1 : 0.9;
          let weight = isInterchange ? 2.5 : 2;

          if (role === 'originDestination') {
            radius = 11;
            color = '#0f172a';
            fillColor = '#facc15';
            fillOpacity = 1;
            weight = 3;
          } else if (role === 'origin') {
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

          // Accessibility filter highlighting
          if (isAccHighlighted && !role) {
            radius = 9;
            color = '#7c3aed';
            fillColor = '#a78bfa';
            fillOpacity = 1;
            weight = 3;
          } else if (isAccDimmed && !role) {
            fillOpacity = 0.25;
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
          {showBusStops && <BusStopLayer locale={locale} />}

          {/* LRT Station Markers (Static + Live Popup) */}
          {showLRT && <LRTStationLayer locale={locale} />}
        </Suspense>

        <MapAccessPanel
          stationMarkers={stationMarkers}
          routeKeyStationIds={routeKeyStationIds}
          exitReenterStations={exitReenterStations}
          originId={originId}
          destinationId={destinationId}
          locale={locale}
          showBusStops={showBusStops}
          showLRT={showLRT}
          highlightedStationIds={highlightedStationIds}
        />
      </MapContainer>

    </div>
  );
}
