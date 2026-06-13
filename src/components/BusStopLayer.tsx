import { Fragment, useMemo } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { busStopLocations } from '../data/unifiedNetwork';
import { Locale } from '../types';
import { getLocalizedText } from '../data/zhHansText';

interface BusStopLayerProps {
  locale: Locale;
}

export default function BusStopLayer({ locale }: BusStopLayerProps) {
  const markers = useMemo(() => busStopLocations, []);

  return (
    <>
      {markers.map((stop) => (
        <Fragment key={`${stop.id}-${stop.lat}-${stop.lng}`}>
          <CircleMarker
            center={[stop.lat, stop.lng]}
            radius={3.5}
            interactive={false}
            pathOptions={{
              color: '#0891b2',
              fillColor: '#06b6d4',
              fillOpacity: 0.85,
              weight: 1,
            }}
          />
          <CircleMarker
            center={[stop.lat, stop.lng]}
            radius={12}
            pathOptions={{
              color: '#0891b2',
              opacity: 0,
              fillColor: '#06b6d4',
              fillOpacity: 0.01,
              weight: 0,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -6]}
              className="bus-stop-tooltip"
            >
              <div className="bus-stop-tooltip-content">
                <div className="bus-stop-tooltip-name">{getLocalizedText(stop, locale)}</div>
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
        </Fragment>
      ))}
    </>
  );
}
