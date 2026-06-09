import { useMemo } from 'react';
import { DetailedSegment } from '../types';
import { lineSegments } from '../data/lineSegments';
import { stationCoordinates } from '../data/stationCoordinates';
import { getRouteNodeCoordinate } from '../routePlanner';
import { appendPolylinePositions, getLineEdgePositions, PolylinePosition } from '../utils/polylineGeometry';

export function useMapPolylines(routeSegments?: DetailedSegment[]) {
  // Build polylines from edge-based topology (correct branch connections)
  const edgePolylines = useMemo(() => {
    const result: { lineCode: string; from: string; to: string; positions: PolylinePosition[] }[] = [];
    for (const [lineCode, edges] of Object.entries(lineSegments)) {
      for (const [fromId, toId] of edges) {
        const positions = getLineEdgePositions(lineCode, fromId, toId, stationCoordinates);
        if (positions.length >= 2) {
          result.push({
            lineCode,
            from: fromId,
            to: toId,
            positions,
          });
        }
      }
    }
    return result;
  }, []);

  // Build route highlight polylines from DetailedSegment[]
  const routePolylines = useMemo(() => {
    if (!routeSegments || routeSegments.length === 0) return [];

    const result: {
      segIndex: number;
      lineCode: string;
      positions: PolylinePosition[];
      isWalk: boolean;
    }[] = [];

    for (let si = 0; si < routeSegments.length; si++) {
      const seg = routeSegments[si];
      if (seg.path.length < 2) continue;

      let currentLine = '';
      let currentPositions: PolylinePosition[] = [];

      for (let i = 0; i < seg.path.length - 1; i++) {
        const fromStep = seg.path[i];
        const toStep = seg.path[i + 1];
        const fromCoord = getRouteNodeCoordinate(fromStep.stationId) || stationCoordinates[fromStep.stationId];
        const toCoord = getRouteNodeCoordinate(toStep.stationId) || stationCoordinates[toStep.stationId];
        if (!fromCoord || !toCoord) continue;

        const edgeLine = fromStep.lineCode || toStep.lineCode || 'TRANSFER';
        const edgePositions = getLineEdgePositions(edgeLine, fromStep.stationId, toStep.stationId, stationCoordinates);
        const positions = edgePositions.length >= 2
          ? edgePositions
          : [
              [fromCoord.lat, fromCoord.lng],
              [toCoord.lat, toCoord.lng],
            ] as PolylinePosition[];

        if (!currentLine) {
          currentLine = edgeLine;
          currentPositions = positions;
          continue;
        }

        if (edgeLine !== currentLine) {
          if (currentPositions.length > 1) {
            result.push({
              segIndex: si,
              lineCode: currentLine,
              positions: [...currentPositions],
              isWalk: currentLine === 'WALK',
            });
          }
          currentLine = edgeLine;
          currentPositions = positions;
        } else {
          currentPositions = appendPolylinePositions(currentPositions, positions);
        }
      }

      if (currentLine && currentPositions.length > 1) {
        result.push({
          segIndex: si,
          lineCode: currentLine,
          positions: currentPositions,
          isWalk: currentLine === 'WALK',
        });
      }
    }

    return result;
  }, [routeSegments]);

  // Collect exit/re-enter stations (middle stops in multi-segment routes)
  const exitReenterStations = useMemo(() => {
    if (!routeSegments || routeSegments.length <= 1) return [];
    const result: string[] = [];
    for (let i = 0; i < routeSegments.length - 1; i++) {
      result.push(routeSegments[i].to);
    }
    return result;
  }, [routeSegments]);

  return { edgePolylines, routePolylines, exitReenterStations };
}
