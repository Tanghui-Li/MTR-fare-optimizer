import { describe, expect, it } from 'vitest';
import type { DetailedSegment } from '../types';
import { buildRouteStationLookup } from './mapRouteStations';

describe('buildRouteStationLookup', () => {
  it('is inactive when no route is displayed', () => {
    const lookup = buildRouteStationLookup();

    expect(lookup.isActive).toBe(false);
    expect(lookup.stationIds.size).toBe(0);
    expect(lookup.lineByStation.size).toBe(0);
  });

  it('collects only stations from the displayed route path', () => {
    const routeSegments: DetailedSegment[] = [
      {
        from: 'A',
        to: 'C',
        fare: 10,
        path: [
          { stationId: 'A', lineCode: 'KTL', mode: 'MTR' },
          { stationId: 'B', lineCode: 'KTL', mode: 'MTR' },
          { stationId: 'C', lineCode: 'KTL', mode: 'MTR' },
        ],
      },
      {
        from: 'C',
        to: 'lrt:110',
        fare: 0,
        path: [
          { stationId: 'C', lineCode: 'TRANSFER', mode: 'TRANSFER' },
          { stationId: 'lrt:110', lineCode: '505', mode: 'LRT' },
        ],
      },
    ];

    const lookup = buildRouteStationLookup(routeSegments);

    expect(lookup.isActive).toBe(true);
    expect(Array.from(lookup.stationIds)).toEqual(['A', 'B', 'C', 'lrt:110']);
    expect(lookup.stationIds.has('D')).toBe(false);
  });

  it('keeps the first non-transfer line code for station styling', () => {
    const lookup = buildRouteStationLookup([
      {
        from: 'A',
        to: 'B',
        fare: 0,
        path: [
          { stationId: 'A', lineCode: 'TRANSFER', mode: 'TRANSFER' },
          { stationId: 'B', lineCode: 'TML', mode: 'MTR' },
          { stationId: 'B', lineCode: 'KTL', mode: 'MTR' },
        ],
      },
    ]);

    expect(lookup.lineByStation.get('A')).toBeUndefined();
    expect(lookup.lineByStation.get('B')).toBe('TML');
  });
});
