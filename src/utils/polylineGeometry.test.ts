import { describe, expect, it } from 'vitest';
import { trackEdgeKey, TrackGeometryMap } from '../data/trackGeometries';
import { appendPolylinePositions, getLineEdgePositions } from './polylineGeometry';

const coordinates = {
  A: { lat: 0, lng: 0 },
  B: { lat: 1, lng: 1 },
  C: { lat: 2, lng: 1 },
};

describe('polyline geometry', () => {
  it('creates sampled positions while preserving edge endpoints', () => {
    const positions = getLineEdgePositions('TEST', 'A', 'B', coordinates, {}, 4);

    expect(positions).toHaveLength(5);
    expect(positions[0]).toEqual([0, 0]);
    expect(positions[positions.length - 1]).toEqual([1, 1]);
  });

  it('uses real geometry overrides in both directions', () => {
    const geometryMap: TrackGeometryMap = {
      TEST: {
        [trackEdgeKey('A', 'B')]: [
          coordinates.A,
          { lat: 0.5, lng: 0.25 },
          coordinates.B,
        ],
      },
    };

    expect(getLineEdgePositions('TEST', 'A', 'B', coordinates, geometryMap)).toEqual([
      [0, 0],
      [0.5, 0.25],
      [1, 1],
    ]);
    expect(getLineEdgePositions('TEST', 'B', 'A', coordinates, geometryMap)).toEqual([
      [1, 1],
      [0.5, 0.25],
      [0, 0],
    ]);
  });

  it('slices configured real line paths before using fitted curves', () => {
    const positions = getLineEdgePositions('TEST', 'A', 'B', coordinates, {}, 4, {
      TEST: [[
        coordinates.A,
        { lat: 0.2, lng: 0.8 },
        coordinates.B,
        coordinates.C,
      ]],
    });

    expect(positions).toEqual([
      [0, 0],
      [0.2, 0.8],
      [1, 1],
    ]);
  });

  it('appends connected edge positions without duplicating the shared station', () => {
    expect(appendPolylinePositions([[0, 0], [1, 1]], [[1, 1], [2, 1]])).toEqual([
      [0, 0],
      [1, 1],
      [2, 1],
    ]);
  });
});
