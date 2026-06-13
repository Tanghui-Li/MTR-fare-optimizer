import { CircleMarker, Tooltip } from 'react-leaflet';
import LRTPopup from './LRTPopup';
import lrtStationsData from '../data/lrtStations.json';
import { Locale } from '../types';
import { getLocalizedText, getSecondaryLocalizedText } from '../data/zhHansText';

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
            color: '#64748b',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -5]} className="station-tooltip">
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: '12px' }}>{getLocalizedText(stop, locale)}</strong>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>{getSecondaryLocalizedText(stop, locale)}</div>
              <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>{locale === 'en' ? 'Light Rail Station' : locale === 'zh-Hans' ? '轻铁站' : '輕鐵站'}</div>
            </div>
          </Tooltip>
          <LRTPopup stationId={stop.id} stationName={getLocalizedText(stop, locale)} locale={locale} />
        </CircleMarker>
      ))}
    </>
  );
}
