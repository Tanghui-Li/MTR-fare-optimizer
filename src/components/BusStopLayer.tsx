import { Fragment, useMemo } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { busStopLocations } from '../data/unifiedNetwork';
import { Locale } from '../types';
import { getLocalizedText } from '../data/zhHansText';

interface BusStopLayerProps {
  locale: Locale;
  routeStationIds?: ReadonlySet<string>;
  isRouteActive?: boolean;
}

export default function BusStopLayer({ locale, routeStationIds, isRouteActive = false }: BusStopLayerProps) {
  const markers = useMemo(() => busStopLocations, []);

  return (
    <>
      {markers.map((stop) => {
        const isRouteStop = routeStationIds?.has(`bus:${stop.id}`) ?? false;
        const isDimmed = isRouteActive && !isRouteStop;

        return (
          <Fragment key={`${stop.id}-${stop.lat}-${stop.lng}`}>
            <CircleMarker
              center={[stop.lat, stop.lng]}
              radius={isRouteStop ? 5 : 3.5}
              interactive={false}
              pathOptions={{
                color: isDimmed ? '#94a3b8' : '#0891b2',
                opacity: isDimmed ? 0.24 : 1,
                fillColor: isDimmed ? '#cbd5e1' : '#06b6d4',
                fillOpacity: isDimmed ? 0.12 : 0.85,
                weight: isRouteStop ? 2 : 1,
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
        );
      })}
    </>
  );
}
