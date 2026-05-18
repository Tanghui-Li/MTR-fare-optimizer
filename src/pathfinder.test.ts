import { describe, expect, it } from 'vitest';
import { findCheapestRoute, type FareMatrix } from './pathfinder';

describe('findCheapestRoute', () => {
  it('returns zero fare when origin and destination are the same', () => {
    const fares: FareMatrix = {
      A: { A: 0, B: 5 },
      B: { A: 5, B: 0 },
    };

    expect(findCheapestRoute(fares, 'A', 'A')).toEqual({
      totalFare: 0,
      route: ['A'],
    });
  });

  it('chooses the cheapest multi-hop path over a more expensive direct fare', () => {
    const fares: FareMatrix = {
      A: { A: 0, B: 2, C: 10 },
      B: { A: 2, B: 0, C: 3 },
      C: { A: 10, B: 3, C: 0 },
    };

    expect(findCheapestRoute(fares, 'A', 'C')).toEqual({
      totalFare: 5,
      route: ['A', 'B', 'C'],
    });
  });
});
