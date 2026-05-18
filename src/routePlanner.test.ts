import { describe, expect, it } from 'vitest';
import fareMatrixData from './fare_matrix.json';
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

  it('returns an infinite fare when no graph path exists', () => {
    const result = findMultimodalRoute({}, 'missing:origin', 'missing:destination', 'octopus', 'optimized');

    expect(result.totalFare).toBe(Number.POSITIVE_INFINITY);
    expect(result.route).toEqual(['missing:origin', 'missing:destination']);
    expect(result.segments).toHaveLength(1);
  });
});
