import { describe, expect, it } from 'vitest';
import fareMatrixData from './data/fare_matrix.json';
import { findMultimodalRoute } from './routePlanner';
import type { UnifiedFareMatrix } from './types';

const fareMatrix = fareMatrixData as UnifiedFareMatrix;

describe('findMultimodalRoute', () => {
  it('returns a zero-fare single-station route for the same origin and destination', () => {
    const result = findMultimodalRoute(fareMatrix.octopus, '1', '1', 'octopus', 'optimized');

    expect(result.totalFare).toBe(0);
    expect(result.route).toEqual(['1']);
    expect(result.segments).toEqual([
      {
        from: '1',
        to: '1',
        fare: 0,
        path: [{ stationId: '1', lineCode: 'TRANSFER', mode: 'TRANSFER' }],
        lineLabel: 'TRANSFER',
        mode: 'TRANSFER',
      },
    ]);
  });

  it('finds a finite route for adjacent MTR stations in the real fare matrix', () => {
    const result = findMultimodalRoute(fareMatrix.octopus, '1', '2', 'octopus', 'optimized');

    expect(Number.isFinite(result.totalFare)).toBe(true);
    expect(result.totalFare).toBeGreaterThan(0);
    expect(result.route[0]).toBe('1');
    expect(result.route[result.route.length - 1]).toBe('2');
    expect(result.segments?.length).toBeGreaterThan(0);
  });

  it('uses the valid Tsing Yi Airport Express interchange without looping back for Airport to Hong Kong with Octopus', () => {
    const result = findMultimodalRoute(fareMatrix.octopus, '47', '39', 'octopus', 'optimized');

    expect(result.totalFare).toBe(73);
    expect(result.route).toEqual(['47', '42', '39']);
    expect(result.segments).toEqual([
      {
        from: '47',
        to: '42',
        fare: 73,
        path: [
          { stationId: '47', lineCode: 'AEL', mode: 'AEL' },
          { stationId: '42', lineCode: 'AEL', mode: 'AEL' },
        ],
        lineLabel: 'AEL',
        mode: 'AEL',
      },
      {
        from: '42',
        to: '39',
        fare: 0,
        path: [
          { stationId: '42', lineCode: 'TCL', mode: 'MTR' },
          { stationId: '21', lineCode: 'TCL', mode: 'MTR' },
          { stationId: '53', lineCode: 'TCL', mode: 'MTR' },
          { stationId: '41', lineCode: 'TCL', mode: 'MTR' },
          { stationId: '40', lineCode: 'TCL', mode: 'MTR' },
          { stationId: '39', lineCode: 'TCL', mode: 'MTR' },
        ],
        lineLabel: 'MTR',
        mode: 'MTR',
      },
    ]);
  });

  it('keeps the Airport Express direct fare as the regular route for Airport to Hong Kong', () => {
    const result = findMultimodalRoute(fareMatrix.octopus, '47', '39', 'octopus', 'boring');

    expect(result.totalFare).toBe(120);
    expect(result.route).toEqual(['47', '39']);
    expect(result.segments).toEqual([
      {
        from: '47',
        to: '39',
        fare: 120,
        path: [
          { stationId: '47', lineCode: 'AEL', mode: 'AEL' },
          { stationId: '42', lineCode: 'AEL', mode: 'AEL' },
          { stationId: '40', lineCode: 'AEL', mode: 'AEL' },
          { stationId: '39', lineCode: 'AEL', mode: 'AEL' },
        ],
        lineLabel: 'AEL',
        mode: 'AEL',
      },
    ]);
  });

  it('charges the normal MTR leg for Airport to Hong Kong with a single ticket interchange', () => {
    const result = findMultimodalRoute(fareMatrix.single, '47', '39', 'single', 'optimized');

    expect(result.totalFare).toBe(96);
    expect(result.route).toEqual(['47', '42', '39']);
    expect(result.segments?.[0]?.fare).toBe(80);
    expect(result.segments?.[1]?.fare).toBe(16);
  });

  it('returns an infinite fare when no graph path exists', () => {
    const result = findMultimodalRoute({}, 'missing:origin', 'missing:destination', 'octopus', 'optimized');

    expect(result.totalFare).toBe(Number.POSITIVE_INFINITY);
    expect(result.route).toEqual(['missing:origin', 'missing:destination']);
    expect(result.segments).toHaveLength(1);
  });
});
