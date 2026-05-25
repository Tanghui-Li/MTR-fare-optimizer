import { GraphEdge, TransportMode } from '../types';

const MODE_BITS: Record<TransportMode, number> = {
  MTR: 1,
  AEL: 2,
  LRT: 4,
  NWBUS: 8,
  TAIPOBUS: 16,
  TRANSFER: 0,
};

export function edgeModeBit(mode: TransportMode): number {
  return MODE_BITS[mode] || 0;
}

export interface GraphState {
  nodeId: string;
  usedMask: number;
  totalFare: number;
  transfers: number;
  stops: number;
  previousKey: string | null;
  viaEdge: GraphEdge | null;
}

export function bfsPath(start: string, end: string, adjacency: Map<string, Set<string>>): string[] {
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

export function reconstructPath(states: Map<string, GraphState>, finalKey: string): { route: string[]; edges: GraphEdge[] } {
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

export function dijkstra(
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
    if (prev) {
      if (prev.totalFare < state.totalFare) return;
      if (prev.totalFare === state.totalFare) {
        if (prev.transfers < state.transfers) return;
        if (prev.transfers === state.transfers && prev.stops <= state.stops) return;
      }
    }
    states.set(key, state);
    queue.push(state);
  };

  pushState({ nodeId: originId, usedMask: 0, totalFare: 0, transfers: 0, stops: 0, previousKey: null, viaEdge: null });

  let bestKey: string | null = null;
  let bestFare = Number.POSITIVE_INFINITY;
  let bestTransfers = Number.POSITIVE_INFINITY;
  let bestStops = Number.POSITIVE_INFINITY;

  while (queue.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i++) {
      const q = queue[i];
      const b = queue[bestIndex];
      if (q.totalFare < b.totalFare) {
        bestIndex = i;
      } else if (q.totalFare === b.totalFare) {
        if (q.transfers < b.transfers) {
          bestIndex = i;
        } else if (q.transfers === b.transfers && q.stops < b.stops) {
          bestIndex = i;
        }
      }
    }
    const current = queue.splice(bestIndex, 1)[0];
    const currentKey = `${current.nodeId}|${current.usedMask}`;

    if (
      current.totalFare > bestFare ||
      (current.totalFare === bestFare && current.transfers > bestTransfers) ||
      (current.totalFare === bestFare && current.transfers === bestTransfers && current.stops > bestStops)
    ) {
      continue;
    }

    if (current.nodeId === destinationId) {
      const isBetter = 
        current.totalFare < bestFare ||
        (current.totalFare === bestFare && current.transfers < bestTransfers) ||
        (current.totalFare === bestFare && current.transfers === bestTransfers && current.stops < bestStops);
        
      if (isBetter) {
        bestFare = current.totalFare;
        bestTransfers = current.transfers;
        bestStops = current.stops;
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
      const nextTransfers = current.transfers + (edge.mode === 'TRANSFER' ? 1 : 0);
      const nextStops = current.stops + 1;
      const nextKey = `${edge.to}|${nextMask}`;
      
      const prev = states.get(nextKey);
      if (prev) {
        if (prev.totalFare < nextFare) continue;
        if (prev.totalFare === nextFare) {
          if (prev.transfers < nextTransfers) continue;
          if (prev.transfers === nextTransfers && prev.stops <= nextStops) continue;
        }
      }

      const nextState: GraphState = {
        nodeId: edge.to,
        usedMask: nextMask,
        totalFare: nextFare,
        transfers: nextTransfers,
        stops: nextStops,
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
