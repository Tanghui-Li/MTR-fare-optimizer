import { lineSegments } from '../data/lineSegments';
import {
  LatLngCoordinate,
  trackEdgeKey,
  trackGeometries,
  trackLinePaths,
  TrackGeometryMap,
  TrackLinePathMap,
} from '../data/trackGeometries';

export type PolylinePosition = [number, number];

type CoordinateMap = Record<string, LatLngCoordinate>;

const DEFAULT_SAMPLES_PER_EDGE = 10;
const MAX_TRACK_SNAP_DISTANCE_METERS = 1800;

function toPosition(coord: LatLngCoordinate): PolylinePosition {
  return [coord.lat, coord.lng];
}

function distanceMeters(a: LatLngCoordinate, b: LatLngCoordinate): number {
  const latScale = 110540;
  const lngScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180) * 111320;
  return Math.hypot((a.lat - b.lat) * latScale, (a.lng - b.lng) * lngScale);
}

function hasSameEndpoint(a: PolylinePosition, b: PolylinePosition): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function buildAdjacency(edges: [string, string][]): Record<string, string[]> {
  const adjacency: Record<string, string[]> = {};
  for (const [from, to] of edges) {
    adjacency[from] = adjacency[from] || [];
    adjacency[to] = adjacency[to] || [];
    adjacency[from].push(to);
    adjacency[to].push(from);
  }
  return adjacency;
}

function chooseContinuation(
  stationId: string,
  excludedId: string,
  anchorId: string,
  adjacency: Record<string, string[]>,
  coordinates: CoordinateMap,
): string | null {
  const station = coordinates[stationId];
  const anchor = coordinates[anchorId];
  if (!station || !anchor) return null;

  const baseLat = station.lat - anchor.lat;
  const baseLng = station.lng - anchor.lng;
  const baseLength = Math.hypot(baseLat, baseLng);
  if (baseLength === 0) return null;

  let bestId: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidateId of adjacency[stationId] || []) {
    if (candidateId === excludedId) continue;
    const candidate = coordinates[candidateId];
    if (!candidate) continue;

    const candidateLat = candidate.lat - station.lat;
    const candidateLng = candidate.lng - station.lng;
    const candidateLength = Math.hypot(candidateLat, candidateLng);
    if (candidateLength === 0) continue;

    const score = (baseLat * candidateLat + baseLng * candidateLng) / (baseLength * candidateLength);
    if (score > bestScore) {
      bestScore = score;
      bestId = candidateId;
    }
  }

  return bestId;
}

function interpolateCatmullRom(
  p0: LatLngCoordinate,
  p1: LatLngCoordinate,
  p2: LatLngCoordinate,
  p3: LatLngCoordinate,
  samples: number,
): PolylinePosition[] {
  const result: PolylinePosition[] = [];
  const safeSamples = Math.max(1, samples);

  for (let i = 0; i <= safeSamples; i++) {
    const t = i / safeSamples;
    const t2 = t * t;
    const t3 = t2 * t;

    const lat = 0.5 * (
      (2 * p1.lat) +
      (-p0.lat + p2.lat) * t +
      (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
      (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3
    );
    const lng = 0.5 * (
      (2 * p1.lng) +
      (-p0.lng + p2.lng) * t +
      (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2 +
      (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3
    );

    result.push([lat, lng]);
  }

  result[0] = toPosition(p1);
  result[result.length - 1] = toPosition(p2);
  return result;
}

function getTrackGeometryOverride(
  lineCode: string,
  fromId: string,
  toId: string,
  geometryMap: TrackGeometryMap,
): PolylinePosition[] | null {
  const lineGeometry = geometryMap[lineCode];
  if (!lineGeometry) return null;

  const forward = lineGeometry[trackEdgeKey(fromId, toId)];
  if (forward && forward.length >= 2) return forward.map(toPosition);

  const reverse = lineGeometry[trackEdgeKey(toId, fromId)];
  if (reverse && reverse.length >= 2) return reverse.map(toPosition).reverse();

  return null;
}

function interpolatePoint(a: LatLngCoordinate, b: LatLngCoordinate, t: number): LatLngCoordinate {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

function projectToPath(point: LatLngCoordinate, path: LatLngCoordinate[]): {
  distance: number;
  index: number;
  t: number;
  along: number;
} | null {
  if (path.length < 2) return null;

  let best: { distance: number; index: number; t: number; along: number } | null = null;
  let along = 0;
  for (let index = 0; index < path.length - 1; index++) {
    const from = path[index];
    const to = path[index + 1];
    const dx = to.lng - from.lng;
    const dy = to.lat - from.lat;
    const segmentLengthSquared = dx * dx + dy * dy;
    const rawT = segmentLengthSquared === 0
      ? 0
      : ((point.lng - from.lng) * dx + (point.lat - from.lat) * dy) / segmentLengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const projected = interpolatePoint(from, to, t);
    const distance = distanceMeters(point, projected);
    const projectedAlong = along + distanceMeters(from, projected);

    if (!best || distance < best.distance) {
      best = { distance, index, t, along: projectedAlong };
    }

    along += distanceMeters(from, to);
  }

  return best;
}

function sliceTrackPath(
  fromCoord: LatLngCoordinate,
  toCoord: LatLngCoordinate,
  path: LatLngCoordinate[],
  fromProjection: NonNullable<ReturnType<typeof projectToPath>>,
  toProjection: NonNullable<ReturnType<typeof projectToPath>>,
): PolylinePosition[] {
  let startProjection = fromProjection;
  let endProjection = toProjection;
  let reversed = false;

  if (startProjection.along > endProjection.along) {
    startProjection = toProjection;
    endProjection = fromProjection;
    reversed = true;
  }

  const start = interpolatePoint(path[startProjection.index], path[startProjection.index + 1], startProjection.t);
  const end = interpolatePoint(path[endProjection.index], path[endProjection.index + 1], endProjection.t);
  const sliced: PolylinePosition[] = [toPosition(start)];

  for (let index = startProjection.index + 1; index <= endProjection.index; index++) {
    sliced.push(toPosition(path[index]));
  }
  sliced.push(toPosition(end));

  const positions = reversed ? sliced.reverse() : sliced;
  positions[0] = toPosition(fromCoord);
  positions[positions.length - 1] = toPosition(toCoord);
  return positions;
}

function getTrackLinePathPositions(
  lineCode: string,
  fromId: string,
  toId: string,
  coordinates: CoordinateMap,
  linePathMap: TrackLinePathMap,
): PolylinePosition[] | null {
  const fromCoord = coordinates[fromId];
  const toCoord = coordinates[toId];
  if (!fromCoord || !toCoord) return null;

  let best: {
    path: LatLngCoordinate[];
    fromProjection: NonNullable<ReturnType<typeof projectToPath>>;
    toProjection: NonNullable<ReturnType<typeof projectToPath>>;
    score: number;
  } | null = null;

  for (const path of linePathMap[lineCode] || []) {
    const fromProjection = projectToPath(fromCoord, path);
    const toProjection = projectToPath(toCoord, path);
    if (!fromProjection || !toProjection) continue;
    if (
      fromProjection.distance > MAX_TRACK_SNAP_DISTANCE_METERS ||
      toProjection.distance > MAX_TRACK_SNAP_DISTANCE_METERS
    ) {
      continue;
    }

    const length = Math.abs(toProjection.along - fromProjection.along);
    if (length <= 50) continue;

    const score = fromProjection.distance + toProjection.distance + length * 0.001;
    if (!best || score < best.score) {
      best = { path, fromProjection, toProjection, score };
    }
  }

  if (!best) return null;
  return sliceTrackPath(fromCoord, toCoord, best.path, best.fromProjection, best.toProjection);
}

export function getLineEdgePositions(
  lineCode: string,
  fromId: string,
  toId: string,
  coordinates: CoordinateMap,
  geometryMap: TrackGeometryMap = trackGeometries,
  samplesPerEdge = DEFAULT_SAMPLES_PER_EDGE,
  linePathMap: TrackLinePathMap = trackLinePaths,
): PolylinePosition[] {
  const override = getTrackGeometryOverride(lineCode, fromId, toId, geometryMap);
  if (override) return override;

  const trackPositions = getTrackLinePathPositions(lineCode, fromId, toId, coordinates, linePathMap);
  if (trackPositions) return trackPositions;

  const from = coordinates[fromId];
  const to = coordinates[toId];
  if (!from || !to) return [];

  const edges = lineSegments[lineCode] || [];
  const adjacency = buildAdjacency(edges);
  const previousId = chooseContinuation(fromId, toId, toId, adjacency, coordinates);
  const nextId = chooseContinuation(toId, fromId, fromId, adjacency, coordinates);
  const previous = previousId ? coordinates[previousId] : from;
  const next = nextId ? coordinates[nextId] : to;

  return interpolateCatmullRom(previous, from, to, next, samplesPerEdge);
}

export function appendPolylinePositions(
  target: PolylinePosition[],
  positions: PolylinePosition[],
): PolylinePosition[] {
  if (positions.length === 0) return target;
  if (target.length === 0) return [...positions];

  const [first, ...rest] = positions;
  if (hasSameEndpoint(target[target.length - 1], first)) {
    return [...target, ...rest];
  }

  return [...target, ...positions];
}
