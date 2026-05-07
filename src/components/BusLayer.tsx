import { useEffect, useState, useCallback } from 'react';
import { CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { fetchMtrBusSchedule } from '../services/mtrApi';
import { mtrBusRoutes } from '../data/lineColors';
import busStopNamesData from '../data/busStopNames.json';

const busStopNames = busStopNamesData as Record<string, { zh: string; en: string }>;

interface LiveBus {
  busId: string;
  route: string;
  lat: number;
  lng: number;
  departureTimeText: string;
  isDelayed: boolean;
  stopName: string;      // Nearest bus stop name (Chinese)
  stopNameEn: string;    // Nearest bus stop name (English)
}

export default function BusLayer() {
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [loading, setLoading] = useState(false);
  const map = useMap();

  const fetchAllBuses = useCallback(async () => {
    setLoading(true);
    const allBuses: LiveBus[] = [];
    const seenBusIds = new Set<string>();

    // Only fetch routes visible in the current viewport to reduce API calls
    const bounds = map.getBounds();

    const fetchPromises = mtrBusRoutes.map(async (route) => {
      try {
        const data = await fetchMtrBusSchedule(route);
        if (data.busStop) {
          for (const stop of data.busStop) {
            const stopId = stop.busStopId || '';
            const stopInfo = busStopNames[stopId];
            const stopName = stopInfo?.zh || stopId;
            const stopNameEn = stopInfo?.en || '';

            for (const bus of stop.bus || []) {
              if (
                bus.busLocation &&
                bus.busLocation.latitude !== 0 &&
                bus.busLocation.longitude !== 0
              ) {
                const busKey = `${bus.busId}-${route}`;
                if (!seenBusIds.has(busKey)) {
                  seenBusIds.add(busKey);
                  const lat = bus.busLocation.latitude;
                  const lng = bus.busLocation.longitude;
                  if (
                    lat >= bounds.getSouth() - 0.1 &&
                    lat <= bounds.getNorth() + 0.1 &&
                    lng >= bounds.getWest() - 0.1 &&
                    lng <= bounds.getEast() + 0.1
                  ) {
                    allBuses.push({
                      busId: bus.busId,
                      route,
                      lat,
                      lng,
                      departureTimeText: bus.departureTimeText || '',
                      isDelayed: bus.isDelayed === '1',
                      stopName,
                      stopNameEn,
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
    setBuses(allBuses);
    setLoading(false);
  }, [map]);

  useEffect(() => {
    fetchAllBuses();
    const interval = setInterval(fetchAllBuses, 30000);
    return () => clearInterval(interval);
  }, [fetchAllBuses]);

  return (
    <>
      {buses.map((bus) => (
        <CircleMarker
          key={`${bus.busId}-${bus.route}-${bus.lat}-${bus.lng}`}
          center={[bus.lat, bus.lng]}
          radius={5}
          pathOptions={{
            color: '#fff',
            fillColor: bus.isDelayed ? '#ef4444' : '#f59e0b',
            fillOpacity: 0.9,
            weight: 1.5,
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="bus-tooltip"
          >
            <div className="bus-tooltip-content">
              <div className="bus-tooltip-header">
                <span className="bus-route-badge">{bus.route}</span>
                <span className="bus-stop-name">{bus.stopName}</span>
              </div>
              {bus.stopNameEn && (
                <div className="bus-stop-name-en">{bus.stopNameEn}</div>
              )}
              <div className="bus-tooltip-eta">
                {bus.departureTimeText || '行駛中'}
              </div>
              {bus.isDelayed && (
                <div className="bus-tooltip-delayed">⚠ 延誤</div>
              )}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
