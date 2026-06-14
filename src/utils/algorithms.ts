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
  totalMinutes: number;
  score: number;
  gateChanges: number;
  transfers: number;
  stops: number;
  previousKey: string | null;
  viaEdge: GraphEdge | null;
}

export interface DijkstraOptions {
  boringMode?: boolean;
  scoreEdge?: (edge: GraphEdge, current: GraphState) => number;
  maxGateChanges?: number | null;
}

function getStateKey(state: Pick<GraphState, 'nodeId' | 'usedMask' | 'gateChanges'>): string {
  return `${state.nodeId}|${state.usedMask}|${state.gateChanges}`;
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
  boringModeOrOptions: boolean | DijkstraOptions,
): { route: string[]; edges: GraphEdge[]; totalFare: number } {
  if (originId === destinationId) {
    return { route: [originId], edges: [], totalFare: 0 };
  }

  const options: DijkstraOptions = typeof boringModeOrOptions === 'boolean'
    ? { boringMode: boringModeOrOptions }
    : boringModeOrOptions;
  const boringMode = Boolean(options.boringMode);
  const scoreEdge = options.scoreEdge ?? ((edge: GraphEdge) => edge.fare);
  const maxGateChanges = options.maxGateChanges;

  const states = new Map<string, GraphState>();
  const queue: GraphState[] = [];
  const pushState = (state: GraphState) => {
    const key = getStateKey(state);
    const prev = states.get(key);
    if (prev) {
      if (prev.score < state.score) return;
      if (prev.score === state.score) {
        if (prev.totalFare < state.totalFare) return;
        if (prev.totalFare === state.totalFare) {
          if (prev.transfers < state.transfers) return;
          if (prev.transfers === state.transfers && prev.stops <= state.stops) return;
        }
      }
    }
    states.set(key, state);
    queue.push(state);
  };

  pushState({
    nodeId: originId,
    usedMask: 0,
    totalFare: 0,
    totalMinutes: 0,
    score: 0,
    transfers: 0,
    gateChanges: 0,
    stops: 0,
    previousKey: null,
    viaEdge: null,
  });

  let bestKey: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestFare = Number.POSITIVE_INFINITY;
  let bestTransfers = Number.POSITIVE_INFINITY;
  let bestStops = Number.POSITIVE_INFINITY;

  while (queue.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i++) {
      const q = queue[i];
      const b = queue[bestIndex];
      if (q.score < b.score) {
        bestIndex = i;
      } else if (q.score === b.score) {
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
    }
    const current = queue.splice(bestIndex, 1)[0];
    const currentKey = getStateKey(current);

    if (
      current.score > bestScore ||
      (current.score === bestScore && current.totalFare > bestFare) ||
      (current.score === bestScore && current.totalFare === bestFare && current.transfers > bestTransfers) ||
      (current.score === bestScore && current.totalFare === bestFare && current.transfers === bestTransfers && current.stops > bestStops)
    ) {
      continue;
    }

    if (current.nodeId === destinationId) {
      const isBetter = 
        current.score < bestScore ||
        (current.score === bestScore && current.totalFare < bestFare) ||
        (current.score === bestScore && current.totalFare === bestFare && current.transfers < bestTransfers) ||
        (current.score === bestScore && current.totalFare === bestFare && current.transfers === bestTransfers && current.stops < bestStops);
        
      if (isBetter) {
        bestScore = current.score;
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
      const addsGateChange = (current.viaEdge?.fare ?? 0) > 0;
      const nextGateChanges = current.gateChanges + (addsGateChange ? 1 : 0);
      const nextTransfers = current.transfers + (edge.mode === 'TRANSFER' ? 1 : 0);
      if (maxGateChanges !== null && maxGateChanges !== undefined && nextGateChanges > maxGateChanges) continue;
      const nextStops = current.stops + 1;
      const nextMinutes = current.totalMinutes + (edge.estimatedMinutes ?? 0);
      const nextScore = current.score + scoreEdge(edge, current);
      const nextKey = `${edge.to}|${nextMask}|${nextGateChanges}`;
      
      const prev = states.get(nextKey);
      if (prev) {
        if (prev.score < nextScore) continue;
        if (prev.score === nextScore) {
          if (prev.totalFare < nextFare) continue;
          if (prev.totalFare === nextFare) {
            if (prev.transfers < nextTransfers) continue;
            if (prev.transfers === nextTransfers && prev.stops <= nextStops) continue;
          }
        }
      }

      const nextState: GraphState = {
        nodeId: edge.to,
        usedMask: nextMask,
        totalFare: nextFare,
        totalMinutes: nextMinutes,
        score: nextScore,
        gateChanges: nextGateChanges,
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
