import { useEffect, useMemo } from 'react';
import { Circle, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Locale, Poi } from '../types';
import { getPoiVisual, getPoiVisualLabel } from '../data/cuisineMap';
import { localizedPoiName } from '../utils/poi';

interface PoiLayerProps {
  pois: Poi[];
  center: { lat: number; lng: number } | null;
  radius: number;
  stationId: string | null;
  activePoiId: string | null;
  flyNonce: number;
  tourPois: Poi[]; // 已按串游顺序排列
  locale: Locale;
  onSelectPoi: (id: string) => void;
}

function makeIcon(poi: Poi, active: boolean): L.DivIcon {
  const visual = getPoiVisual(poi.type, poi.cuisineKey, poi.kind);
  const cls = [
    'poi-pin',
    poi.type,
    active ? 'active' : '',
    poi.featured ? 'featured' : '',
  ].join(' ');
  return L.divIcon({
    className: 'poi-pin-wrap',
    html: `<div class="${cls}"><span class="poi-pin-emoji">${visual.emoji}</span></div>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
    popupAnchor: [0, -34],
  });
}

export default function PoiLayer({
  pois, center, radius, stationId, activePoiId, flyNonce, tourPois, locale, onSelectPoi,
}: PoiLayerProps) {
  const map = useMap();

  // 切换站点：平滑框定到半径范围
  useEffect(() => {
    if (!center) return;
    const bounds = L.latLng(center.lat, center.lng).toBounds(radius * 2.2);
    map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 16, duration: 0.7 });
    // 仅在站点变化时重新框定（radius 变化由滑块即时更新 Circle，无需重新框定）
  }, [stationId]);

  // 选中/定位：飞向目标 POI
  useEffect(() => {
    if (!activePoiId) return;
    const p = pois.find((x) => x.id === activePoiId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [activePoiId, flyNonce]);

  const tourLine = useMemo(() => {
    if (!center || tourPois.length === 0) return null;
    const pts: [number, number][] = [[center.lat, center.lng]];
    for (const p of tourPois) pts.push([p.lat, p.lng]);
    return pts;
  }, [center, tourPois]);

  if (!center) return null;

  return (
    <>
      <Circle
        center={[center.lat, center.lng]}
        radius={radius}
        interactive={false}
        pathOptions={{
          color: '#f43f5e',
          weight: 1.5,
          opacity: 0.5,
          fillColor: '#fb7185',
          fillOpacity: 0.06,
        }}
      />

      {tourLine && tourLine.length >= 2 && (
        <Polyline
          positions={tourLine}
          interactive={false}
          pathOptions={{
            color: '#e11d48',
            weight: 4,
            opacity: 0.85,
            dashArray: '2 8',
            lineCap: 'round',
          }}
        />
      )}

      {pois.map((poi) => {
        const active = poi.id === activePoiId;
        const visual = getPoiVisual(poi.type, poi.cuisineKey, poi.kind);
        return (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lng]}
            icon={makeIcon(poi, active)}
            zIndexOffset={active ? 1000 : poi.featured ? 400 : 0}
            eventHandlers={{ click: () => onSelectPoi(poi.id) }}
          >
            <Tooltip direction="top" offset={[0, -32]} className="poi-pin-tooltip">
              <strong>{localizedPoiName(poi, locale)}</strong>
              <br />
              <span className="poi-pin-tooltip-sub">
                {visual.emoji} {getPoiVisualLabel(visual, locale)} · {poi.distanceM}m
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
