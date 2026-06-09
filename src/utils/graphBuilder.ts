import { FareMatrix, GraphEdge, TicketType, TransportMode } from '../types';
import {
  getBusRouteMode,
  getExplicitBusLrtTransfers,
  getExplicitBusMtrTransfers,
  getHubKey,
  getNode,
  rawBusFareRows,
  rawBusStopRows,
  rawLightRailFareRows,
  rawLightRailRouteRows,
  busStopMergeMap,
} from '../data/unifiedNetwork';
import { lineSegments } from '../data/lineSegments';
import { bfsPath } from './algorithms';

export const mtrAdjacency: Map<string, Set<string>> = (() => {
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

export const mtrEdgeLines: Map<string, string[]> = (() => {
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

export const lrtRouteAdjacency: Map<string, Map<string, Set<string>>> = (() => {
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

export const lrtAdjacency: Map<string, Set<string>> = (() => {
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

export const busRouteAdjacency: Map<string, Map<string, Set<string>>> = (() => {
  const byKey = new Map<string, Array<{ stopId: string; seq: number }>>();
  for (const row of rawBusStopRows) {
    const routeId = row.ROUTE_ID || '';
    const referenceId = row.REFERENCE_ID || routeId;
    const direction = row.DIRECTION || '';
    const stopId = busStopMergeMap.get(row.STATION_ID || '') || row.STATION_ID || '';
    const seq = Number(row.STATION_SEQNO || '0');
    if (!routeId || !stopId || !Number.isFinite(seq)) continue;
    const key = `${referenceId}|${direction}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push({ stopId, seq });
  }

  const result = new Map<string, Map<string, Set<string>>>();
  for (const [key, stops] of byKey.entries()) {
    const graph = new Map<string, Set<string>>();
    const ordered = stops.sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < ordered.length; i++) {
      const from = ordered[i - 1].stopId;
      const to = ordered[i].stopId;
      if (!graph.has(from)) graph.set(from, new Set());
      if (!graph.has(to)) graph.set(to, new Set());
      graph.get(from)!.add(to);
      graph.get(to)!.add(from);
    }
    result.set(key, graph);
  }
  return result;
})();

export function getMtrLineCodeBetween(from: string, to: string, fallback: string, preferred?: string): string {
  const candidates = mtrEdgeLines.get(`${from}|${to}`);
  if (!candidates || candidates.length === 0) return fallback;
  if (preferred && candidates.includes(preferred)) return preferred;
  if (candidates.includes(fallback)) return fallback;
  if (fallback === 'MTR') {
    const nonAelCandidate = candidates.find((lineCode) => lineCode !== 'AEL');
    if (nonAelCandidate) return nonAelCandidate;
  }
  return candidates[0];
}

export function expandMtrEdge(startId: string, endId: string, allowAirportExpress = true): string[] {
  if (startId === endId) return [startId];

  interface MtrState {
    nodeId: string;
    lineCode: string | null;
    transfers: number;
    stops: number;
    previousKey: string | null;
  }

  const states = new Map<string, MtrState>();
  const queue: MtrState[] = [];

  const pushState = (state: MtrState) => {
    const key = `${state.nodeId}|${state.lineCode || 'START'}`;
    const prev = states.get(key);
    if (prev) {
      if (prev.transfers < state.transfers) return;
      if (prev.transfers === state.transfers && prev.stops <= state.stops) return;
    }
    states.set(key, state);
    queue.push(state);
  };

  pushState({ nodeId: startId, lineCode: null, transfers: 0, stops: 0, previousKey: null });

  let bestKey: string | null = null;
  let bestTransfers = Number.POSITIVE_INFINITY;
  let bestStops = Number.POSITIVE_INFINITY;

  while (queue.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i++) {
      const q = queue[i];
      const b = queue[bestIndex];
      if (q.transfers < b.transfers) {
        bestIndex = i;
      } else if (q.transfers === b.transfers && q.stops < b.stops) {
        bestIndex = i;
      }
    }
    const current = queue.splice(bestIndex, 1)[0];
    const currentKey = `${current.nodeId}|${current.lineCode || 'START'}`;

    if (current.transfers > bestTransfers || (current.transfers === bestTransfers && current.stops > bestStops)) {
      continue;
    }

    if (current.nodeId === endId) {
      const isBetter = current.transfers < bestTransfers || (current.transfers === bestTransfers && current.stops < bestStops);
      if (isBetter) {
        bestTransfers = current.transfers;
        bestStops = current.stops;
        bestKey = currentKey;
      }
      continue;
    }

    const neighbors = mtrAdjacency.get(current.nodeId) || new Set();
    for (const next of neighbors) {
      const lines = (mtrEdgeLines.get(`${current.nodeId}|${next}`) || [])
        .filter((lineCode) => allowAirportExpress || lineCode !== 'AEL');
      for (const lineCode of lines) {
        const nextTransfers = current.transfers + (current.lineCode && current.lineCode !== lineCode ? 1 : 0);
        const nextStops = current.stops + 1;
        const nextKey = `${next}|${lineCode}`;
        
        const prev = states.get(nextKey);
        if (prev) {
          if (prev.transfers < nextTransfers) continue;
          if (prev.transfers === nextTransfers && prev.stops <= nextStops) continue;
        }

        const nextState: MtrState = {
          nodeId: next,
          lineCode,
          transfers: nextTransfers,
          stops: nextStops,
          previousKey: currentKey,
        };
        states.set(nextKey, nextState);
        queue.push(nextState);
      }
    }
  }

  if (!bestKey) return [startId, endId];

  const path: string[] = [];
  let cursor: string | null = bestKey;
  while (cursor) {
    const state = states.get(cursor);
    if (!state) break;
    if (path[0] !== state.nodeId) {
      path.unshift(state.nodeId);
    }
    cursor = state.previousKey;
  }
  return path;
}

export function expandEdgeStations(edge: GraphEdge): string[] {
  if (edge.from === edge.to) return [edge.from];

  if ((edge.mode === 'MTR' || edge.mode === 'AEL') && !edge.from.startsWith('lrt:') && !edge.to.startsWith('lrt:') && !edge.from.startsWith('bus:') && !edge.to.startsWith('bus:')) {
    return expandMtrEdge(edge.from, edge.to, edge.mode === 'AEL');
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
    const graphKey = edge.busKey || edge.lineCode;
    const graph = busRouteAdjacency.get(graphKey);
    if (!graph) return [edge.from, edge.to];
    const stopPath = bfsPath(from, to, graph);
    return stopPath.map((id) => `bus:${id}`);
  }

  return [edge.from, edge.to];
}

const AEL_CITY_STATIONS = new Set(['39', '40', '42']);
const AEL_EXPO_AIRPORT = new Set(['47', '56']);

export function isAirportExpressFareEdge(from: string, to: string): boolean {
  return (
    (AEL_EXPO_AIRPORT.has(from) && (AEL_CITY_STATIONS.has(to) || AEL_EXPO_AIRPORT.has(to))) ||
    (AEL_EXPO_AIRPORT.has(to) && (AEL_CITY_STATIONS.has(from) || AEL_EXPO_AIRPORT.has(from)))
  );
}

function isAelMtrConnection(from: string, to: string): boolean {
  return (
    from !== to &&
    (AEL_CITY_STATIONS.has(from) || AEL_CITY_STATIONS.has(to)) &&
    !AEL_EXPO_AIRPORT.has(from) &&
    !AEL_EXPO_AIRPORT.has(to)
  );
}

function addEdge(graph: Map<string, GraphEdge[]>, edge: GraphEdge) {
  if (!graph.has(edge.from)) graph.set(edge.from, []);
  graph.get(edge.from)!.push(edge);
}

function addUndirectedEdge(graph: Map<string, GraphEdge[]>, from: string, to: string, fare: number, mode: TransportMode, lineCode: string) {
  addEdge(graph, { from, to, fare, mode, lineCode });
  addEdge(graph, { from: to, to: from, fare, mode, lineCode });
}

export function getLineCodeFromLightRailRow(row: Record<string, string>): string {
  return row['Line Code'] || row['LINE_CODE'] || row['ROUTE_ID'] || '';
}

export function normalizeLrtStopId(rawId: string): string {
  const digits = (rawId || '').trim().replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(3, '0');
}

// Global cache for the built graph to prevent rebuilding on every pathfinding request
const graphCache = new Map<string, Map<string, GraphEdge[]>>();

export function buildGraph(ticketType: TicketType, isAELTrip: boolean, mtrFareMatrix: FareMatrix): Map<string, GraphEdge[]> {
  const cacheKey = `${ticketType}|${isAELTrip}`;
  if (graphCache.has(cacheKey)) {
    return graphCache.get(cacheKey)!;
  }

  const graph = new Map<string, GraphEdge[]>();

  // MTR / AEL direct fares.
  for (const [from, dests] of Object.entries(mtrFareMatrix)) {
    for (const [to, rawFare] of Object.entries(dests)) {
      if (!getNode(from) || !getNode(to)) continue;
      let fare = rawFare;

      if (ticketType === 'octopus') {
        if (isAELTrip) {
          const isAELLink = isAirportExpressFareEdge(from, to) && rawFare > 0;
          if (!isAELLink && isAelMtrConnection(from, to)) {
            fare = 0;
          }
        } else if (AEL_EXPO_AIRPORT.has(from) || AEL_EXPO_AIRPORT.has(to)) {
          fare = Number.POSITIVE_INFINITY;
        }
      }

      if (!Number.isFinite(fare)) continue;
      const isAelEdge = isAirportExpressFareEdge(from, to);
      addEdge(graph, { from, to, fare, mode: isAelEdge ? 'AEL' : 'MTR', lineCode: isAelEdge ? 'AEL' : 'MTR' });
    }
  }

  // Light Rail fares: connect every pair of stops in the same direction group.
  const lrtFareLookup = new Map<string, number>();
  for (const row of rawLightRailFareRows) {
    const from = normalizeLrtStopId(row.from_station_id || row.FROM_STATION_ID || '');
    const to = normalizeLrtStopId(row.to_station_id || row.TO_STATION_ID || '');
    const fare = Number(ticketType === 'octopus' ? row.fare_octo_adult : row.fare_single_adult);
    if (from && to && Number.isFinite(fare)) {
      lrtFareLookup.set(`${from}|${to}`, fare);
    }
  }

  const lrtGroups = new Map<string, Array<{ routeCode: string; id: string; sequence: number }>>();
  for (const row of rawLightRailRouteRows) {
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
  for (const row of rawBusFareRows) {
    const routeId = row.ROUTE_ID || '';
    const fare = Number(ticketType === 'octopus' ? row.FARE_OCTO_ADULT : row.FARE_SINGLE_ADULT);
    if (!routeId || !Number.isFinite(fare)) continue;
    const current = busFareLookup.get(routeId);
    busFareLookup.set(routeId, current === undefined ? fare : Math.min(current, fare));
  }

  const busGroups = new Map<string, Array<{ routeId: string; referenceId: string; direction: string; stopId: string; sequence: number }>>();
  for (const row of rawBusStopRows) {
    const routeId = row.ROUTE_ID || '';
    const referenceId = row.REFERENCE_ID || routeId;
    const direction = row.DIRECTION || '';
    const stopId = busStopMergeMap.get(row.STATION_ID || '') || row.STATION_ID || '';
    const sequence = Number(row.STATION_SEQNO || '0');
    if (!routeId || !stopId) continue;
    const key = `${referenceId || routeId}|${direction}`;
    if (!busGroups.has(key)) busGroups.set(key, []);
    busGroups.get(key)!.push({ routeId, referenceId, direction, stopId, sequence });
  }

  for (const entries of busGroups.values()) {
    const ordered = entries.sort((a, b) => a.sequence - b.sequence);
    const routeId = ordered[0]?.routeId || '';
    const referenceId = ordered[0]?.referenceId || routeId;
    const direction = ordered[0]?.direction || '';
    const fare = busFareLookup.get(routeId) ?? busFareLookup.get(referenceId);
    if (fare === undefined || !Number.isFinite(fare)) continue;
    const mode = getBusRouteMode(routeId);
    const busKey = `${referenceId || routeId}|${direction}`;
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const from = `bus:${ordered[i].stopId}`;
        const to = `bus:${ordered[j].stopId}`;
        addEdge(graph, { from, to, fare, mode, lineCode: routeId, busKey });
        addEdge(graph, { from: to, to: from, fare, mode, lineCode: routeId, busKey });
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

  // Explicit bus-to-MTR transfers (strict matching, no fuzzy name inference).
  const busTransfers = getExplicitBusMtrTransfers();
  for (const { busId, mtrId } of busTransfers) {
    addUndirectedEdge(graph, busId, mtrId, 0, 'TRANSFER', 'TRANSFER');
  }

  const busLrtTransfers = getExplicitBusLrtTransfers();
  for (const { busId, lrtId } of busLrtTransfers) {
    addUndirectedEdge(graph, busId, `lrt:${lrtId}`, 0, 'TRANSFER', 'TRANSFER');
  }

  graphCache.set(cacheKey, graph);
  return graph;
}
