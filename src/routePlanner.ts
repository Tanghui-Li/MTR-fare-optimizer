import { FareMatrix, DetailedSegment, PathStep, RouteResult, TicketType, TransportMode, GraphEdge, RouteOptimizationGoal, RoutePlanningPreferences } from './types';
import {
  getNodeCoordinates,
  getNodeLabel,
} from './data/unifiedNetwork';
import { dijkstra } from './utils/algorithms';
import { buildGraph, expandEdgeStations, getMtrLineCodeBetween, isAirportExpressFareEdge } from './utils/graphBuilder';

function buildDetailedSegments(route: string[], edges: GraphEdge[]): DetailedSegment[] {
  if (route.length === 0) return [];
  if (edges.length === 0) {
    return [
      {
        from: route[0],
        to: route[0],
        fare: 0,
        path: [{ stationId: route[0], lineCode: 'TRANSFER', mode: 'TRANSFER' }],
        lineLabel: 'TRANSFER',
        mode: 'TRANSFER',
      },
    ];
  }

  const segments: DetailedSegment[] = [];
  let segmentStartEdge = 0;

  const flushSegment = (startEdge: number, endEdge: number) => {
    if (endEdge < startEdge) return;

    const rawSegmentEdges = edges.slice(startEdge, endEdge + 1);
    let segmentEdges = rawSegmentEdges;
    while (segmentEdges.length > 0 && segmentEdges[0].mode === 'TRANSFER') {
      segmentEdges = segmentEdges.slice(1);
    }
    if (segmentEdges.length === 0) segmentEdges = rawSegmentEdges;
    const expandedNodes: string[] = [];
    const expandedHopLineCodes: string[] = [];
    const expandedHopModes: TransportMode[] = [];
    let lastHopLineCode: string | undefined;
    
    for (let i = 0; i < segmentEdges.length; i++) {
      const expanded = expandEdgeStations(segmentEdges[i]);
      const edge = segmentEdges[i];
      if (expanded.length > 1) {
        for (let j = 0; j < expanded.length - 1; j++) {
          const from = expanded[j];
          const to = expanded[j + 1];
          let hopLineCode = edge.lineCode;
          if (edge.mode === 'MTR' || edge.mode === 'AEL') {
            hopLineCode = getMtrLineCodeBetween(from, to, hopLineCode, lastHopLineCode);
          }
          expandedHopLineCodes.push(hopLineCode);
          expandedHopModes.push(edge.mode);
          lastHopLineCode = hopLineCode;
        }
      }
      if (i === 0) {
        expandedNodes.push(...expanded);
      } else {
        expandedNodes.push(...expanded.slice(1));
      }
    }
    const segmentNodes = expandedNodes.length > 0 ? expandedNodes : [segmentEdges[0].from, segmentEdges[segmentEdges.length - 1].to];
    if (segmentNodes.length === 0) return;

    const path: PathStep[] = [];
    for (let index = 0; index < segmentNodes.length; index++) {
      const stationId = segmentNodes[index];
      const hopIndex = Math.min(index, expandedHopLineCodes.length - 1);
      const lineCode = expandedHopLineCodes[hopIndex] || segmentEdges[0].lineCode;
      const mode = expandedHopModes[hopIndex] || segmentEdges[0].mode;
      path.push({ stationId, lineCode, mode });
    }

    const fare = segmentEdges.reduce((sum, edge) => sum + edge.fare, 0);
    segments.push({
      from: segmentNodes[0],
      to: segmentNodes[segmentNodes.length - 1],
      fare,
      path,
      lineLabel: segmentEdges[0].lineCode,
      mode: segmentEdges[0].mode,
    });
  };

  for (let edgeIndex = 1; edgeIndex < edges.length; edgeIndex++) {
    const prevEdge = edges[edgeIndex - 1];
    // End one fare leg before moving on, so UI can show where to exit/re-enter.
    if (prevEdge.fare > 0) {
      flushSegment(segmentStartEdge, edgeIndex - 1);
      segmentStartEdge = edgeIndex;
    }
  }

  flushSegment(segmentStartEdge, edges.length - 1);
  return segments;
}

export function findMultimodalRoute(
  fareMatrix: FareMatrix,
  originId: string,
  destinationId: string,
  ticketType: TicketType,
  mode: 'optimized' | 'boring',
  preferences?: Pick<RoutePlanningPreferences, 'goal' | 'maxGateChanges'>,
): RouteResult {
  const isAELTrip = ['47', '56'].includes(originId) || ['47', '56'].includes(destinationId);
  const directFare = fareMatrix[originId]?.[destinationId];
  if (mode === 'boring' && Number.isFinite(directFare)) {
    const isAelEdge = isAirportExpressFareEdge(originId, destinationId);
    const edge: GraphEdge = {
      from: originId,
      to: destinationId,
      fare: directFare,
      mode: isAelEdge ? 'AEL' : 'MTR',
      lineCode: isAelEdge ? 'AEL' : 'MTR',
    };

    return {
      totalFare: directFare,
      route: [originId, destinationId],
      segments: buildDetailedSegments([originId, destinationId], [edge]),
    };
  }

  const graph = buildGraph(ticketType, isAELTrip, fareMatrix);
  const goal = preferences?.goal || 'fare';
  const result = dijkstra(graph, originId, destinationId, {
    boringMode: mode === 'boring',
    maxGateChanges: preferences?.maxGateChanges ?? null,
    scoreEdge: getScoreEdge(goal),
  });

  return {
    totalFare: result.totalFare,
    route: result.route,
    segments: buildDetailedSegments(result.route, result.edges),
  };
}

export function findRouteCandidateSet(
  fareMatrix: FareMatrix,
  originId: string,
  destinationId: string,
  ticketType: TicketType,
  preferences: RoutePlanningPreferences,
): {
  lowestFare: RouteResult;
  regular: RouteResult;
  fastest: RouteResult;
  balanced: RouteResult;
} {
  const gateOptions = { maxGateChanges: preferences.maxGateChanges };
  return {
    lowestFare: findMultimodalRoute(fareMatrix, originId, destinationId, ticketType, 'optimized', {
      ...gateOptions,
      goal: 'fare',
    }),
    regular: findMultimodalRoute(fareMatrix, originId, destinationId, ticketType, 'boring', {
      ...gateOptions,
      goal: 'time',
    }),
    fastest: findMultimodalRoute(fareMatrix, originId, destinationId, ticketType, 'optimized', {
      ...gateOptions,
      goal: 'time',
    }),
    balanced: findMultimodalRoute(fareMatrix, originId, destinationId, ticketType, 'optimized', {
      ...gateOptions,
      goal: 'balanced',
    }),
  };
}

function getScoreEdge(goal: RouteOptimizationGoal) {
  return (edge: GraphEdge) => {
    const minutes = edge.estimatedMinutes ?? 0;
    const gatePenalty = edge.fare > 0 ? 1.4 : 0;
    const transferPenalty = edge.mode === 'TRANSFER' ? 3 : 0;

    if (goal === 'time') {
      return minutes + edge.fare * 0.16 + gatePenalty + transferPenalty;
    }

    if (goal === 'balanced') {
      return edge.fare * 0.7 + minutes * 0.65 + gatePenalty * 2 + transferPenalty;
    }

    return edge.fare + minutes * 0.03 + gatePenalty * 0.2 + transferPenalty * 0.1;
  };
}

export function getRouteNodeLabel(nodeId: string, locale: 'zh-Hant' | 'en' | 'zh-Hans'): string {
  return getNodeLabel(nodeId, locale);
}

export function getRouteNodeCoordinate(nodeId: string): { lat: number; lng: number } | undefined {
  return getNodeCoordinates(nodeId);
}
