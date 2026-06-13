import { useEffect, useState, useCallback } from 'react';
import { CircleMarker, useMap, Popup } from 'react-leaflet';
import { fetchMtrBusSchedule } from '../services/mtrApi';
import { mtrBusRoutes } from '../data/lineColors';
import busStopNamesData from '../data/busStopNames.json';
import { Locale } from '../types';
import { t } from '../i18n';
import { cleanBusArrivalText } from '../data/unifiedNetwork';
import { getLocalizedText } from '../data/zhHansText';

const busStopNames = busStopNamesData as Record<string, { zh: string; en: string }>;

function localizeBusTimeText(text: string, locale: Locale): string {
  if (locale !== 'zh-Hans') return text;
  const statusMap: Record<string, string> = {
    '即將開出': '即将开出',
    '已離開': '已离开',
    '行駛中': '行驶中',
    '到達': '到达',
    '已到達': '已到达',
  };
  return statusMap[text] ?? text;
}

interface BusVehicle {
  busId: string;
  route: string;
  lat: number;
  lng: number;
  nextStopName: string;
  timeText: string;
  isDelayed: boolean;
  remark: string;
  arrivalTimeInSecond: number;
}

interface BusLayerProps {
  locale: Locale;
}

export default function BusLayer({ locale }: BusLayerProps) {
  const [vehicles, setVehicles] = useState<BusVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<BusVehicle | null>(null);
  const map = useMap();

  const fetchAllBuses = useCallback(async () => {
    setLoading(true);
    const vehicleMap = new Map<string, BusVehicle>();
    const bounds = map.getBounds();
    const failedRoutes: string[] = [];

    const fetchPromises = mtrBusRoutes.map(async (route) => {
      try {
        const data = await fetchMtrBusSchedule(route);
        if (data.busStop) {
          for (const stop of data.busStop) {
            const stopId = stop.busStopId || '';
            const stopInfo = busStopNames[stopId];
            const stopName = stopInfo ? getLocalizedText(stopInfo, locale) : stopId;
            
            for (const bus of stop.bus || []) {
              if (
                bus.busLocation &&
                bus.busLocation.latitude !== 0 &&
                bus.busLocation.longitude !== 0
              ) {
                const busId = bus.busId;
                const arrivalSeconds = parseInt(bus.arrivalTimeInSecond) || 999999;
                
                const lat = bus.busLocation.latitude;
                const lng = bus.busLocation.longitude;

                // Only process if in view
                if (
                  lat >= bounds.getSouth() - 0.1 &&
                  lat <= bounds.getNorth() + 0.1 &&
                  lng >= bounds.getWest() - 0.1 &&
                  lng <= bounds.getEast() + 0.1
                ) {
                  // If we've seen this bus before, only update if this stop is EARLIER (the real next stop)
                  const existing = vehicleMap.get(busId);
                  if (!existing || arrivalSeconds < existing.arrivalTimeInSecond) {
                    vehicleMap.set(busId, {
                      busId,
                      route,
                      lat,
                      lng,
                      nextStopName: stopName,
                      timeText: localizeBusTimeText(cleanBusArrivalText(bus.departureTimeText || '行駛中'), locale),
                      isDelayed: bus.isDelayed === '1',
                      remark: bus.busRemark || '',
                      arrivalTimeInSecond: arrivalSeconds
                    });
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        failedRoutes.push(route);
        console.warn(`Failed to fetch bus route ${route}:`, e);
      }
    });

    await Promise.all(fetchPromises);
    const nextVehicles = Array.from(vehicleMap.values());

    if (failedRoutes.length === mtrBusRoutes.length) {
      setError(locale === 'en'
        ? 'Unable to update live buses. Existing positions are kept.'
        : locale === 'zh-Hans'
          ? '无法更新实时巴士，已保留现有车辆位置。'
          : '無法更新實時巴士，已保留現有車輛位置。');
    } else {
      setVehicles(nextVehicles);
      setLastUpdated(new Date().toLocaleTimeString(locale === 'en' ? 'en-GB' : 'zh-HK'));
      setError(failedRoutes.length > 0
        ? locale === 'en'
          ? `${failedRoutes.length} bus routes failed to update.`
          : locale === 'zh-Hans'
            ? `${failedRoutes.length} 条巴士线路更新失败。`
            : `${failedRoutes.length} 條巴士路線更新失敗。`
        : null);
    }

    setLoading(false);
  }, [map, locale]);

  useEffect(() => {
    fetchAllBuses();
    const interval = setInterval(fetchAllBuses, 30000);
    return () => clearInterval(interval);
  }, [fetchAllBuses]);

  const openVehicleDetails = (vehicle: BusVehicle) => {
    map.setView([vehicle.lat, vehicle.lng], Math.max(map.getZoom(), 15), { animate: true });
    setSelectedVehicle(vehicle);
  };

  const getVehicleLabel = (vehicle: BusVehicle) => {
    const delayText = vehicle.isDelayed
      ? locale === 'en' ? 'delayed' : locale === 'zh-Hans' ? '延误' : '延誤'
      : locale === 'en' ? 'on time' : locale === 'zh-Hans' ? '正常' : '正常';
    return `${t(locale, 'vehicle')} ${vehicle.busId}, ${vehicle.route}, ${t(locale, 'nextStop')} ${vehicle.nextStopName}, ${vehicle.timeText}, ${delayText}`;
  };

  return (
    <>
      {vehicles.map((v) => (
        <CircleMarker
          key={`${v.busId}-${v.route}`}
          center={[v.lat, v.lng]}
          radius={5}
          pathOptions={{
            color: '#fff',
            fillColor: v.isDelayed ? '#ef4444' : '#f59e0b',
            fillOpacity: 0.9,
            weight: 1.5,
          }}
        >
          <Popup className="bus-popup" minWidth={280} maxWidth={280}>
            <div className="bus-popup-content">
              <div className="bus-popup-header">
                <span className="bus-route-badge">{v.route}</span>
                <span className="bus-id-tag">{locale === 'en' ? 'Vehicle' : locale === 'zh-Hans' ? '车辆编号' : '車輛編號'} #{v.busId}</span>
              </div>
              
              <div className="bus-eta-list">
                <div className="bus-eta-item" style={{ borderBottom: 'none' }}>
                  <div className="bus-eta-main">
                    <span className="bus-dest">
                      {v.remark && v.remark.trim() 
                        ? (v.remark.includes('往') ? v.remark : `${t(locale, 'busTo')} ${v.remark}`)
                        : t(locale, 'busHeading')}
                    </span>
                  </div>
                  <div className="bus-eta-footer" style={{ marginTop: '8px' }}>
                    <span className="bus-next-stop-label">{t(locale, 'nextStop')}</span>
                    <span className="bus-stop-name-highlight">{v.nextStopName}</span>
                  </div>
                  <div className="bus-eta-footer" style={{ marginTop: '6px' }}>
                    <span className={`bus-eta-time ${v.isDelayed ? 'delayed' : ''}`}>
                      {v.timeText.includes('即將開出') || v.timeText.includes('即将开出') || v.timeText.includes('已離開') || v.timeText.includes('已离开') || v.timeText.includes('行駛中') || v.timeText.includes('行驶中') || v.timeText.includes('到達') || v.timeText.includes('到达')
                        ? v.timeText
                        : `${t(locale, 'estimated')} ${v.timeText}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      <div className="map-bus-status-panel" role="status" aria-live="polite">
        <div className="map-bus-status-main">
          <strong>{t(locale, 'liveBusStatus')}</strong>
          <span>
            {loading
              ? t(locale, 'loading')
              : error || `${vehicles.length} ${t(locale, 'vehicle')}${lastUpdated ? ` · ${t(locale, 'updated')}: ${lastUpdated}` : ''}`}
          </span>
        </div>
        <button type="button" onClick={fetchAllBuses} disabled={loading}>
          {t(locale, 'retry')}
        </button>
      </div>

      <details className="map-access-panel map-access-panel-live">
        <summary>{t(locale, 'liveBusAccessibleList')}</summary>
        {selectedVehicle && (
          <div className="map-access-selected" role="status" aria-live="polite">
            <strong>{t(locale, 'mapItemSelected')}: {selectedVehicle.route} #{selectedVehicle.busId}</strong>
            <span>{getVehicleLabel(selectedVehicle)}</span>
          </div>
        )}
        <div className="map-access-list">
          {vehicles.length > 0 ? vehicles.map((vehicle) => (
            <button
              key={`access-${vehicle.busId}-${vehicle.route}`}
              type="button"
              className="map-access-item"
              aria-label={`${t(locale, 'openMapItem')}: ${getVehicleLabel(vehicle)}`}
              onClick={() => openVehicleDetails(vehicle)}
            >
              <span className={`map-access-shape ${vehicle.isDelayed ? 'important' : 'square'}`} aria-hidden="true">
                {vehicle.isDelayed ? '!' : '■'}
              </span>
              <span className="map-access-item-text">
                <span className="map-access-item-name">{vehicle.route} #{vehicle.busId}</span>
                <span className="map-access-item-meta">{t(locale, 'nextStop')} {vehicle.nextStopName} · {vehicle.timeText}</span>
              </span>
            </button>
          )) : (
            <div className="map-access-empty">{loading ? t(locale, 'loading') : t(locale, 'noData')}</div>
          )}
        </div>
      </details>
    </>
  );
}
