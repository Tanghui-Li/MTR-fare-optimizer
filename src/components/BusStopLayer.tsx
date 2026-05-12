import { useMemo } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import busStopData from '../data/busStopLocations.json';
import { Locale } from '../types';

interface BusStopEntry {
  id: string;
  lat: number;
  lng: number;
  zh: string;
  en: string;
  routes: string[];
}

const busStops = busStopData as BusStopEntry[];

interface BusStopLayerProps {
  locale: Locale;
}

export default function BusStopLayer({ locale }: BusStopLayerProps) {
  const markers = useMemo(() => busStops, []);

  return (
    <>
      {markers.map((stop) => (
        <CircleMarker
          key={`${stop.id}-${stop.lat}-${stop.lng}`}
          center={[stop.lat, stop.lng]}
          radius={3.5}
          pathOptions={{
            color: '#0891b2',
            fillColor: '#06b6d4',
            fillOpacity: 0.85,
            weight: 1,
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -6]}
            className="bus-stop-tooltip"
          >
            <div className="bus-stop-tooltip-content">
              <div className="bus-stop-tooltip-name">{locale === 'en' ? stop.en : stop.zh}</div>
              {stop.en && locale !== 'en' && (
                <div className="bus-stop-tooltip-name-en">{stop.en}</div>
              )}
              <div className="bus-stop-tooltip-routes">
                {stop.routes.map(r => (
                  <span key={r} className="bus-stop-route-badge">{r}</span>
                ))}
              </div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
