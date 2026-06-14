import { Fragment } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import LRTPopup from './LRTPopup';
import lrtStationsData from '../data/lrtStations.json';
import { Locale } from '../types';
import { getLocalizedText, getSecondaryLocalizedText } from '../data/zhHansText';

const lrtStations = lrtStationsData as Record<string, { id: string; lat: number; lng: number; zh: string; en: string }>;

interface LRTStationLayerProps {
  locale: Locale;
  routeStationIds?: ReadonlySet<string>;
  isRouteActive?: boolean;
}

export default function LRTStationLayer({ locale, routeStationIds, isRouteActive = false }: LRTStationLayerProps) {
  if (!lrtStations) return null;

  return (
    <>
      {Object.values(lrtStations).map((stop) => {
        const isRouteStop = routeStationIds?.has(`lrt:${stop.id}`) ?? false;
        const isDimmed = isRouteActive && !isRouteStop;

        return (
          <Fragment key={`lrt-${stop.id}`}>
            <CircleMarker
              center={[stop.lat, stop.lng]}
              radius={isRouteStop ? 6 : 4}
              interactive={false}
              pathOptions={{
                color: isDimmed ? '#94a3b8' : '#64748b',
                opacity: isDimmed ? 0.28 : 1,
                fillColor: '#ffffff',
                fillOpacity: isDimmed ? 0.12 : 1,
                weight: isRouteStop ? 3 : 2,
              }}
            />
            <CircleMarker
              center={[stop.lat, stop.lng]}
              radius={12}
              pathOptions={{
                color: '#64748b',
                opacity: 0,
                fillColor: '#ffffff',
                fillOpacity: 0.01,
                weight: 0,
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
          </Fragment>
        );
      })}
    </>
  );
}
