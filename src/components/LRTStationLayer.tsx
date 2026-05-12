import { CircleMarker, Tooltip } from 'react-leaflet';
import LRTPopup from './LRTPopup';
import lrtStationsData from '../data/lrtStations.json';
import { Locale } from '../types';

const lrtStations = lrtStationsData as Record<string, { id: string; lat: number; lng: number; zh: string; en: string }>;

interface LRTStationLayerProps {
  locale: Locale;
}

export default function LRTStationLayer({ locale }: LRTStationLayerProps) {
  if (!lrtStations) return null;

  return (
    <>
      {Object.values(lrtStations).map((stop) => (
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
              <strong style={{ fontSize: '12px' }}>{locale === 'en' ? stop.en : stop.zh}</strong>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>{locale === 'en' ? stop.zh : stop.en}</div>
              <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>{locale === 'en' ? 'Light Rail Station' : locale === 'zh-Hans' ? '轻铁站' : '輕鐵站'}</div>
            </div>
          </Tooltip>
          <LRTPopup stationId={stop.id} stationName={locale === 'en' ? stop.en : stop.zh} locale={locale} />
        </CircleMarker>
      ))}
    </>
  );
}
