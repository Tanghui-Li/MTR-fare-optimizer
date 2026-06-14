import type { DetailedSegment } from '../types';

export interface RouteStationLookup {
  stationIds: Set<string>;
  lineByStation: Map<string, string>;
  isActive: boolean;
}

export function buildRouteStationLookup(routeSegments?: DetailedSegment[]): RouteStationLookup {
  const stationIds = new Set<string>();
  const lineByStation = new Map<string, string>();

  for (const segment of routeSegments ?? []) {
    for (const step of segment.path) {
      stationIds.add(step.stationId);
      if (step.lineCode && step.lineCode !== 'TRANSFER' && !lineByStation.has(step.stationId)) {
        lineByStation.set(step.stationId, step.lineCode);
      }
    }
  }

  return {
    stationIds,
    lineByStation,
    isActive: stationIds.size > 0,
  };
}
