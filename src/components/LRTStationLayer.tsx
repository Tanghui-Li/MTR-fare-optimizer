import { CircleMarker, Tooltip, LayerGroup } from 'react-leaflet';
import LRTPopup from './LRTPopup';
import lrtStationsData from '../data/lrtStations.json';

const lrtStations = lrtStationsData as Record<string, { id: string; lat: number; lng: number; zh: string; en: string }>;

export default function LRTStationLayer() {
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
              <strong style={{ fontSize: '12px' }}>{stop.zh}</strong>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>{stop.en}</div>
              <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>Light Rail Station</div>
            </div>
          </Tooltip>
          <LRTPopup stationId={stop.id} stationName={stop.zh} />
        </CircleMarker>
      ))}
    </>
  );
}
