import { FareMatrix, DetailedSegment, PathStep, RouteResult, TicketType, TransportMode } from './types';
import {
  getBusRouteMode,
  getHubKey,
  getNode,
  getNodeCoordinates,
  getNodeLabel,
  rawBusFareRows,
  rawBusStopRows,
  rawLightRailFareRows,
  rawLightRailRouteRows,
} from './data/unifiedNetwork';
import { lineSegments } from './data/lineSegments';

interface GraphEdge {
  from: string;
  to: string;
  fare: number;
  mode: TransportMode;
  lineCode: string;
}

const mtrAdjacency: Map<string, Set<string>> = (() => {
  const graph = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
  };
  for (const edges of Object.values(lineSegments)) {
    for (const [a, b] of edges) connect(a, b);
  }
  return graph;
})();

const mtrEdgeLines: Map<string, string[]> = (() => {
  const edgeMap = new Map<string, string[]>();
  const add = (from: string, to: string, lineCode: string) => {
    const key = `${from}|${to}`;
    if (!edgeMap.has(key)) edgeMap.set(key, []);
    const lines = edgeMap.get(key)!;
    if (!lines.includes(lineCode)) lines.push(lineCode);
  };
  for (const [lineCode, edges] of Object.entries(lineSegments)) {
    for (const [from, to] of edges) {
      add(from, to, lineCode);
      add(to, from, lineCode);
    }
  }
  return edgeMap;
})();

const lrtRouteAdjacency: Map<string, Map<string, Set<string>>> = (() => {
  const byRoute = new Map<string, Map<string, Set<string>>>();
  const groups = new Map<string, Array<{ id: string; seq: number }>>();

  for (const row of rawLightRailRouteRows) {
    const routeCode = getLineCodeFromLightRailRow(row);
    const direction = row.Direction || row.DIRECTION || '';
    const stopId = normalizeLrtStopId(row['Stop ID'] || row['STOP_ID'] || '');
    const seq = Number(row.Sequence || row.SEQUENCE || '0');
    if (!routeCode || !stopId || !Number.isFinite(seq)) continue;
    const key = `${routeCode}|${direction}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ id: stopId, seq });
  }

  for (const [key, stops] of groups.entries()) {
    const routeCode = key.split('|')[0];
    if (!byRoute.has(routeCode)) byRoute.set(routeCode, new Map());
    const graph = byRoute.get(routeCode)!;
    const ordered = stops.sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < ordered.length; i++) {
      const from = ordered[i - 1].id;
      const to = ordered[i].id;
      if (!graph.has(from)) graph.set(from, new Set());
      if (!graph.has(to)) graph.set(to, new Set());
      graph.get(from)!.add(to);
      graph.get(to)!.add(from);
    }
  }

  return byRoute;
})();

const lrtAdjacency: Map<string, Set<string>> = (() => {
  const graph = new Map<string, Set<string>>();
  const groups = new Map<string, Array<{ id: string; seq: number }>>();
  for (const row of rawLightRailRouteRows) {
    const routeCode = getLineCodeFromLightRailRow(row);
    const direction = row.Direction || row.DIRECTION || '';
    const stopId = normalizeLrtStopId(row['Stop ID'] || row['STOP_ID'] || '');
    const seq = Number(row.Sequence || row.SEQUENCE || '0');
    if (!routeCode || !stopId || !Number.isFinite(seq)) continue;
    const key = `${routeCode}|${direction}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ id: stopId, seq });
  }
  const connect = (a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
  };
  for (const stops of groups.values()) {
    const ordered = stops.sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < ordered.length; i++) {
      connect(ordered[i - 1].id, ordered[i].id);
    }
  }
  return graph;
})();

const busRouteAdjacency: Map<string, Map<string, Set<string>>> = (() => {
  const byRoute = new Map<string, Array<{ stopId: string; seq: number }>>();
  for (const row of rawBusStopRows) {
    const routeId = row.ROUTE_ID || '';
    const stopId = row.STATION_ID || '';
    const seq = Number(row.STATION_SEQNO || '0');
    if (!routeId || !stopId || !Number.isFinite(seq)) continue;
    if (!byRoute.has(routeId)) byRoute.set(routeId, []);
    byRoute.get(routeId)!.push({ stopId, seq });
  }
  const result = new Map<string, Map<string, Set<string>>>();
  for (const [routeId, stops] of byRoute.entries()) {
    const graph = new Map<string, Set<string>>();
    const ordered = stops.sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1].stopId;
      const b = ordered[i].stopId;
      if (!graph.has(a)) graph.set(a, new Set());
      if (!graph.has(b)) graph.set(b, new Set());
      graph.get(a)!.add(b);
      graph.get(b)!.add(a);
    }
    result.set(routeId, graph);
  }
  return result;
})();

function bfsPath(start: string, end: string, adjacency: Map<string, Set<string>>): string[] {
  if (start === end) return [start];
  if (!adjacency.has(start) || !adjacency.has(end)) return [start, end];

  const queue: string[] = [start];
  const prev = new Map<string, string | null>();
  prev.set(start, null);

  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === end) break;
    for (const next of adjacency.get(cur) || []) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      queue.push(next);
    }
  }

  if (!prev.has(end)) return [start, end];

  const path: string[] = [];
  let cursor: string | null = end;
  while (cursor) {
    path.unshift(cursor);
    cursor = prev.get(cursor) || null;
  }
  return path;
}

function getMtrLineCodeBetween(from: string, to: string, fallback: string, preferred?: string): string {
  const candidates = mtrEdgeLines.get(`${from}|${to}`);
  if (!candidates || candidates.length === 0) return fallback;
  if (preferred && candidates.includes(preferred)) return preferred;
  if (candidates.includes(fallback)) return fallback;
  return candidates[0];
}

function expandEdgeStations(edge: GraphEdge): string[] {
  if (edge.from === edge.to) return [edge.from];

  if ((edge.mode === 'MTR' || edge.mode === 'AEL') && !edge.from.startsWith('lrt:') && !edge.to.startsWith('lrt:') && !edge.from.startsWith('bus:') && !edge.to.startsWith('bus:')) {
    return bfsPath(edge.from, edge.to, mtrAdjacency);
  }

  if (edge.mode === 'LRT' && edge.from.startsWith('lrt:') && edge.to.startsWith('lrt:')) {
    const from = edge.from.slice(4);
    const to = edge.to.slice(4);
    const routeGraph = lrtRouteAdjacency.get(edge.lineCode) || lrtAdjacency;
    const stopPath = bfsPath(from, to, routeGraph);
    return stopPath.map((id) => `lrt:${id}`);
  }

  if ((edge.mode === 'NWBUS' || edge.mode === 'TAIPOBUS') && edge.from.startsWith('bus:') && edge.to.startsWith('bus:')) {
    const from = edge.from.slice(4);
    const to = edge.to.slice(4);
    const graph = busRouteAdjacency.get(edge.lineCode);
    if (!graph) return [edge.from, edge.to];
    const stopPath = bfsPath(from, to, graph);
    return stopPath.map((id) => `bus:${id}`);
  }

  return [edge.from, edge.to];
}

interface GraphState {
  nodeId: string;
  usedMask: number;
  totalFare: number;
  previousKey: string | null;
  viaEdge: GraphEdge | null;
}

const MODE_BITS: Record<TransportMode, number> = {
  MTR: 1,
  AEL: 2,
  LRT: 4,
  NWBUS: 8,
  TAIPOBUS: 16,
  TRANSFER: 0,
};

const AEL_STATIONS = new Set(['39', '40', '42', '47', '56']);
const AEL_EXPO_AIRPORT = new Set(['47', '56']);

function edgeModeBit(mode: TransportMode): number {
  return MODE_BITS[mode] || 0;
}

function addEdge(graph: Map<string, GraphEdge[]>, edge: GraphEdge) {
  if (!graph.has(edge.from)) graph.set(edge.from, []);
  graph.get(edge.from)!.push(edge);
}

function addUndirectedEdge(graph: Map<string, GraphEdge[]>, from: string, to: string, fare: number, mode: TransportMode, lineCode: string) {
  addEdge(graph, { from, to, fare, mode, lineCode });
  addEdge(graph, { from: to, to: from, fare, mode, lineCode });
}

const lightRailFareRows = rawLightRailFareRows;
const lightRailRouteRows = rawLightRailRouteRows;
const busFareRows = rawBusFareRows;
const busStopRows = rawBusStopRows;

function getLineCodeFromLightRailRow(row: Record<string, string>): string {
  return row['Line Code'] || row['LINE_CODE'] || row['ROUTE_ID'] || '';
}

function normalizeLrtStopId(rawId: string): string {
  const digits = (rawId || '').trim().replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(3, '0');
}

function getBusRouteFare(routeId: string, ticketType: TicketType): number {
  const fareField = ticketType === 'octopus' ? 'FARE_OCTO_ADULT' : 'FARE_SINGLE_ADULT';
  const rows = busFareRows.filter((row) => row.ROUTE_ID === routeId);
  let fare = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const parsed = Number(row[fareField]);
    if (Number.isFinite(parsed)) {
      fare = Math.min(fare, parsed);
    }
  }
  return Number.isFinite(fare) ? fare : Number.POSITIVE_INFINITY;
}

function buildGraph(ticketType: TicketType, isAELTrip: boolean, mtrFareMatrix: FareMatrix): Map<string, GraphEdge[]> {
  const graph = new Map<string, GraphEdge[]>();

  // MTR / AEL direct fares.
  for (const [from, dests] of Object.entries(mtrFareMatrix)) {
    for (const [to, rawFare] of Object.entries(dests)) {
      if (!getNode(from) || !getNode(to)) continue;
      let fare = rawFare;

      if (ticketType === 'octopus') {
        if (isAELTrip) {
          const isFromAEL = AEL_STATIONS.has(from);
          const isToAEL = AEL_STATIONS.has(to);
          const isAELLink = isFromAEL && isToAEL && rawFare > 0;
          if (!isAELLink) {
            fare = 0;
          }
        } else if (AEL_EXPO_AIRPORT.has(from) || AEL_EXPO_AIRPORT.has(to)) {
          fare = Number.POSITIVE_INFINITY;
        }
      }

      if (!Number.isFinite(fare)) continue;
      const isAelEdge = AEL_STATIONS.has(from) && AEL_STATIONS.has(to);
      addEdge(graph, { from, to, fare, mode: isAelEdge ? 'AEL' : 'MTR', lineCode: isAelEdge ? 'AEL' : 'MTR' });
    }
  }

  // Light Rail fares: connect every pair of stops in the same direction group.
  const lrtFareLookup = new Map<string, number>();
  for (const row of lightRailFareRows) {
    const from = normalizeLrtStopId(row.from_station_id || row.FROM_STATION_ID || '');
    const to = normalizeLrtStopId(row.to_station_id || row.TO_STATION_ID || '');
    const fare = Number(ticketType === 'octopus' ? row.fare_octo_adult : row.fare_single_adult);
    if (from && to && Number.isFinite(fare)) {
      lrtFareLookup.set(`${from}|${to}`, fare);
    }
  }

  const lrtGroups = new Map<string, Array<{ routeCode: string; id: string; sequence: number }>>();
  for (const row of lightRailRouteRows) {
    const routeCode = getLineCodeFromLightRailRow(row);
    const direction = row.Direction || row.DIRECTION || '';
    const stopId = normalizeLrtStopId(row['Stop ID'] || row['STOP_ID'] || '');
    const sequence = Number(row.Sequence || row.SEQUENCE || '0');
    if (!routeCode || !stopId) continue;
    const key = `${routeCode}|${direction}`;
    if (!lrtGroups.has(key)) lrtGroups.set(key, []);
    lrtGroups.get(key)!.push({ routeCode, id: stopId, sequence });
  }

  for (const entries of lrtGroups.values()) {
    const ordered = entries.sort((a, b) => a.sequence - b.sequence);
    const routeCode = ordered[0]?.routeCode || 'LRT';
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const from = `lrt:${ordered[i].id}`;
        const to = `lrt:${ordered[j].id}`;
        const fare = lrtFareLookup.get(`${ordered[i].id}|${ordered[j].id}`) ?? lrtFareLookup.get(`${ordered[j].id}|${ordered[i].id}`);
        if (fare === undefined) continue;
        addUndirectedEdge(graph, from, to, fare, 'LRT', routeCode);
      }
    }
  }

  // Bus fares and route sequences.
  const busFareLookup = new Map<string, number>();
  for (const row of busFareRows) {
    const routeId = row.ROUTE_ID || '';
    const fare = Number(ticketType === 'octopus' ? row.FARE_OCTO_ADULT : row.FARE_SINGLE_ADULT);
    if (!routeId || !Number.isFinite(fare)) continue;
    const current = busFareLookup.get(routeId);
    busFareLookup.set(routeId, current === undefined ? fare : Math.min(current, fare));
  }

  const busGroups = new Map<string, Array<{ routeId: string; stopId: string; sequence: number }>>();
  for (const row of busStopRows) {
    const routeId = row.ROUTE_ID || '';
    const referenceId = row.REFERENCE_ID || routeId;
    const stopId = row.STATION_ID || '';
    const sequence = Number(row.STATION_SEQNO || '0');
    if (!routeId || !stopId) continue;
    const key = referenceId || routeId;
    if (!busGroups.has(key)) busGroups.set(key, []);
    busGroups.get(key)!.push({ routeId, stopId, sequence });
  }

  for (const entries of busGroups.values()) {
    const ordered = entries.sort((a, b) => a.sequence - b.sequence);
    const routeId = ordered[0]?.routeId || '';
    const fare = busFareLookup.get(routeId);
    if (fare === undefined || !Number.isFinite(fare)) continue;
    const mode = getBusRouteMode(routeId);
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const from = `bus:${ordered[i].stopId}`;
        const to = `bus:${ordered[j].stopId}`;
        addUndirectedEdge(graph, from, to, fare, mode, routeId);
      }
    }
  }

  // Zero-cost hub transfers between nodes that share the same interchange.
  const hubGroups = new Map<string, string[]>();
  for (const nodeId of graph.keys()) {
    const hubKey = getHubKey(nodeId);
    if (!hubKey) continue;
    if (!hubGroups.has(hubKey)) hubGroups.set(hubKey, []);
    hubGroups.get(hubKey)!.push(nodeId);
  }

  for (const group of hubGroups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const from = group[i];
        const to = group[j];
        if (from === to) continue;
        addUndirectedEdge(graph, from, to, 0, 'TRANSFER', 'TRANSFER');
      }
    }
  }

  return graph;
}

function reconstructPath(states: Map<string, GraphState>, finalKey: string): { route: string[]; edges: GraphEdge[] } {
  const route: string[] = [];
  const edges: GraphEdge[] = [];
  let cursor: string | null = finalKey;

  while (cursor) {
    const state = states.get(cursor);
    if (!state) break;
    route.unshift(state.nodeId);
    if (state.viaEdge) {
      edges.unshift(state.viaEdge);
    }
    cursor = state.previousKey;
  }

  return { route, edges };
}

function dijkstra(
  graph: Map<string, GraphEdge[]>,
  originId: string,
  destinationId: string,
  boringMode: boolean,
): { route: string[]; edges: GraphEdge[]; totalFare: number } {
  if (originId === destinationId) {
    return { route: [originId], edges: [], totalFare: 0 };
  }

  const states = new Map<string, GraphState>();
  const queue: GraphState[] = [];
  const pushState = (state: GraphState) => {
    const key = `${state.nodeId}|${state.usedMask}`;
    const prev = states.get(key);
    if (prev && prev.totalFare <= state.totalFare) return;
    states.set(key, state);
    queue.push(state);
  };

  pushState({ nodeId: originId, usedMask: 0, totalFare: 0, previousKey: null, viaEdge: null });

  let bestKey: string | null = null;
  let bestFare = Number.POSITIVE_INFINITY;

  while (queue.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].totalFare < queue[bestIndex].totalFare) bestIndex = i;
    }
    const current = queue.splice(bestIndex, 1)[0];
    const currentKey = `${current.nodeId}|${current.usedMask}`;

    if (current.totalFare > bestFare) continue;
    if (current.nodeId === destinationId) {
      if (current.totalFare < bestFare) {
        bestFare = current.totalFare;
        bestKey = currentKey;
      }
      continue;
    }

    const outgoing = graph.get(current.nodeId) || [];
    for (const edge of outgoing) {
      const bit = edgeModeBit(edge.mode);
      if (boringMode && bit > 0 && (current.usedMask & bit)) continue;

      const nextMask = current.usedMask | bit;
      const nextFare = current.totalFare + edge.fare;
      const nextKey = `${edge.to}|${nextMask}`;
      const prev = states.get(nextKey);
      if (prev && prev.totalFare <= nextFare) continue;

      const nextState: GraphState = {
        nodeId: edge.to,
        usedMask: nextMask,
        totalFare: nextFare,
        previousKey: currentKey,
        viaEdge: edge,
      };
      states.set(nextKey, nextState);
      queue.push(nextState);
    }
  }

  if (!bestKey) {
    return { route: [originId, destinationId], edges: [], totalFare: Number.POSITIVE_INFINITY };
  }

  const result = reconstructPath(states, bestKey);
  return { route: result.route, edges: result.edges, totalFare: bestFare };
}

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

    const segmentEdges = edges.slice(startEdge, endEdge + 1);
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
): RouteResult {
  const isAELTrip = ['47', '56'].includes(originId) || ['47', '56'].includes(destinationId);
  const graph = buildGraph(ticketType, isAELTrip, fareMatrix);
  const result = dijkstra(graph, originId, destinationId, mode === 'boring');

  return {
    totalFare: result.totalFare,
    route: result.route,
    segments: buildDetailedSegments(result.route, result.edges),
  };
}

export function getRouteNodeLabel(nodeId: string, locale: 'zh-Hant' | 'en' | 'zh-Hans'): string {
  return getNodeLabel(nodeId, locale);
}

export function getRouteNodeCoordinate(nodeId: string): { lat: number; lng: number } | undefined {
  return getNodeCoordinates(nodeId);
}
