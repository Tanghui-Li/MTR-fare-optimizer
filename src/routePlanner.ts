/**
 * routePlanner.ts
 *
 * BFS-based MTR route planner.
 * For a given segment (between two exit/re-enter points), finds the path with:
 *   1st key: fewest transfers (line changes)
 *   2nd key: fewest stations traversed
 *
 * Uses the edge-based topology from lineSegments.ts.
 */

import { lineSegments } from './data/lineSegments';
import { PathStep } from './types';

// ==================== Graph Construction ====================

interface Neighbor {
  stationId: string;
  lineCode: string;
}

// adjacency: stationId -> list of (neighbor, lineCode)
const adjacency: Map<string, Neighbor[]> = new Map();

function addEdge(from: string, to: string, lineCode: string) {
  if (!adjacency.has(from)) adjacency.set(from, []);
  if (!adjacency.has(to)) adjacency.set(to, []);
  adjacency.get(from)!.push({ stationId: to, lineCode });
  adjacency.get(to)!.push({ stationId: from, lineCode });
}

// Build from lineSegments
for (const [lineCode, edges] of Object.entries(lineSegments)) {
  for (const [from, to] of edges) {
    addEdge(from, to, lineCode);
  }
}

// Walking interchanges: these let you change between merged hub stations
// Central (1) <-> Hong Kong (39): shared fare zone
// TST (3) <-> East TST (80): shared fare zone
const WALKING_INTERCHANGES: [string, string][] = [
  ['1', '39'],   // Central <-> Hong Kong
  ['3', '80'],   // TST <-> East TST
];

for (const [a, b] of WALKING_INTERCHANGES) {
  // Use a pseudo line code 'WALK' to indicate walking transfer
  addEdge(a, b, 'WALK');
}

// ==================== BFS Path Finding ====================

interface BFSState {
  stationId: string;
  lineCode: string;  // the line we are currently "on"
  transfers: number;
  stationCount: number;
  path: PathStep[];
}

/**
 * Find the optimal path between two stations within a single fare segment.
 * Optimal = fewest transfers, then fewest stations.
 *
 * @param from - Origin station ID
 * @param to - Destination station ID
 * @param forbiddenLines - Optional set of line codes to forbid (e.g., 'AEL' for non-AEL trips)
 * @returns PathStep[] or null if unreachable
 */
export function findSegmentPath(
  from: string,
  to: string,
  forbiddenLines?: Set<string>,
): PathStep[] | null {
  if (from === to) {
    // Same station
    const lines = adjacency.get(from);
    const firstLine = lines?.[0]?.lineCode || 'UNK';
    return [{ stationId: from, lineCode: firstLine }];
  }

  // BFS with state = (stationId, currentLine)
  // We track the best (transfers, stationCount) seen for each (stationId, lineCode) combo
  const visited: Map<string, { transfers: number; stationCount: number }> = new Map();

  const queue: BFSState[] = [];

  // Initialize: start from `from` station on each line that serves it
  const startNeighbors = adjacency.get(from);
  if (!startNeighbors) return null;

  // Collect unique lines at origin
  const startLines = new Set<string>();
  for (const n of startNeighbors) {
    if (n.lineCode !== 'WALK' && !(forbiddenLines?.has(n.lineCode))) {
      startLines.add(n.lineCode);
    }
  }

  for (const lineCode of startLines) {
    const state: BFSState = {
      stationId: from,
      lineCode,
      transfers: 0,
      stationCount: 1,
      path: [{ stationId: from, lineCode }],
    };
    const key = `${from}|${lineCode}`;
    visited.set(key, { transfers: 0, stationCount: 1 });
    queue.push(state);
  }

  let bestResult: BFSState | null = null;

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];

    // Prune: if we already have a result and this state can't beat it
    if (bestResult) {
      if (current.transfers > bestResult.transfers) continue;
      if (
        current.transfers === bestResult.transfers &&
        current.stationCount >= bestResult.stationCount
      )
        continue;
    }

    if (current.stationId === to) {
      if (
        !bestResult ||
        current.transfers < bestResult.transfers ||
        (current.transfers === bestResult.transfers &&
          current.stationCount < bestResult.stationCount)
      ) {
        bestResult = current;
      }
      continue;
    }

    const neighbors = adjacency.get(current.stationId);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (forbiddenLines?.has(neighbor.lineCode)) continue;

      // Determine transfer count
      let newTransfers = current.transfers;
      let effectiveLine = neighbor.lineCode;

      if (neighbor.lineCode === 'WALK') {
        // Walking interchange: use 'WALK' line code explicitly
        effectiveLine = 'WALK';
        // Walking between Central (1) and Hong Kong (39) etc.
      } else if (neighbor.lineCode !== current.lineCode) {
        newTransfers = current.transfers + 1;
      }

      const newStationCount = current.stationCount + 1;

      // Check if this state is worth exploring
      const key = `${neighbor.stationId}|${effectiveLine}`;
      const prevBest = visited.get(key);
      if (prevBest) {
        if (
          newTransfers > prevBest.transfers ||
          (newTransfers === prevBest.transfers &&
            newStationCount >= prevBest.stationCount)
        ) {
          continue;
        }
      }

      visited.set(key, { transfers: newTransfers, stationCount: newStationCount });

      const newPath = [
        ...current.path,
        { stationId: neighbor.stationId, lineCode: effectiveLine },
      ];

      queue.push({
        stationId: neighbor.stationId,
        lineCode: effectiveLine,
        transfers: newTransfers,
        stationCount: newStationCount,
        path: newPath,
      });
    }
  }

  return bestResult?.path || null;
}

// ==================== Full Route Planning ====================

import { DetailedSegment, FareMatrix } from './types';

/**
 * Given the Dijkstra route (list of exit/re-enter station IDs) and fare matrix,
 * compute DetailedSegment[] with full paths for each segment.
 */
export function planDetailedRoute(
  route: string[],
  fareMatrix: FareMatrix,
  forbiddenLines?: Set<string>,
): DetailedSegment[] {
  if (route.length < 2) return [];

  const segments: DetailedSegment[] = [];

  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    const fare = fareMatrix[from]?.[to] ?? 0;
    const path = findSegmentPath(from, to, forbiddenLines) || [
      { stationId: from, lineCode: 'UNK' },
      { stationId: to, lineCode: 'UNK' },
    ];

    segments.push({ from, to, fare, path });
  }

  return segments;
}

/**
 * Plan the "Boring Way" route (direct, no exit-re-enter optimization).
 * For AEL trips with boringRouteDetails, splits into two segments at the hub.
 */
export function planBoringRoute(
  originId: string,
  destinationId: string,
  directFare: number,
  fareMatrix: FareMatrix,
  boringRouteDetails?: { hubId: string; fare1: number; fare2: number },
): DetailedSegment[] {
  if (boringRouteDetails) {
    // Two segments through a hub (AEL transfer)
    const { hubId, fare1, fare2 } = boringRouteDetails;
    
    const path1 = findSegmentPath(originId, hubId) || [
      { stationId: originId, lineCode: 'UNK' },
      { stationId: hubId, lineCode: 'UNK' },
    ];
    const path2 = findSegmentPath(hubId, destinationId) || [
      { stationId: hubId, lineCode: 'UNK' },
      { stationId: destinationId, lineCode: 'UNK' },
    ];

    return [
      { from: originId, to: hubId, fare: fare1, path: path1 },
      { from: hubId, to: destinationId, fare: fare2, path: path2 },
    ];
  }

  // Single direct segment
  const path = findSegmentPath(originId, destinationId) || [
    { stationId: originId, lineCode: 'UNK' },
    { stationId: destinationId, lineCode: 'UNK' },
  ];

  return [{ from: originId, to: destinationId, fare: directFare, path }];
}
