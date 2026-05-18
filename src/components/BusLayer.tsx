import { useEffect, useState, useCallback } from 'react';
import { CircleMarker, useMap, Popup } from 'react-leaflet';
import { fetchMtrBusSchedule } from '../services/mtrApi';
import { mtrBusRoutes } from '../data/lineColors';
import busStopNamesData from '../data/busStopNames.json';
import { Locale } from '../types';
import { t } from '../i18n';
import { cleanBusArrivalText } from '../data/unifiedNetwork';

const busStopNames = busStopNamesData as Record<string, { zh: string; en: string }>;

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
  const map = useMap();

  const fetchAllBuses = useCallback(async () => {
    const vehicleMap = new Map<string, BusVehicle>();
    const bounds = map.getBounds();

    const fetchPromises = mtrBusRoutes.map(async (route) => {
      try {
        const data = await fetchMtrBusSchedule(route);
        if (data.busStop) {
          for (const stop of data.busStop) {
            const stopId = stop.busStopId || '';
            const stopInfo = busStopNames[stopId];
            const stopName = stopInfo?.zh || stopId;
            
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
                      timeText: cleanBusArrivalText(bus.departureTimeText || '行駛中'),
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
        console.warn(`Failed to fetch bus route ${route}:`, e);
      }
    });

    await Promise.all(fetchPromises);
    setVehicles(Array.from(vehicleMap.values()));
  }, [map]);

  useEffect(() => {
    fetchAllBuses();
    const interval = setInterval(fetchAllBuses, 30000);
    return () => clearInterval(interval);
  }, [fetchAllBuses]);

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
    </>
  );
}
