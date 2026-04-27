// pathfinder.ts
export interface FareMatrix {
  [station: string]: { [target: string]: number };
}

export function findCheapestRoute(fares: FareMatrix, start: string, end: string) {
  const distances: { [node: string]: number } = {};
  const previous: { [node: string]: string | null } = {};
  const nodes = new Set<string>();

  // 初始化
  for (const station in fares) {
    distances[station] = Infinity;
    previous[station] = null;
    nodes.add(station);
  }
  distances[start] = 0;

  while (nodes.size > 0) {
    let closestNode: string | null = null;
    for (const node of nodes) {
      if (closestNode === null || distances[node] < distances[closestNode]) {
        closestNode = node;
      }
    }

    if (closestNode === null || distances[closestNode] === Infinity) break;
    if (closestNode === end) break;

    nodes.delete(closestNode);

    for (const neighbor in fares[closestNode]) {
      const alt = distances[closestNode] + fares[closestNode][neighbor];
      // 注意：这里为了防止出现价格一样但疯狂出站的无意义路线，
      // 可以加上一个极小的固定惩罚，例如 + 0.001
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = closestNode;
      }
    }
  }

  // 回溯路径
  const path: string[] = [];
  let current: string | null = end;
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    totalFare: distances[end],
    route: path, // e.g., ["CEN", "MKK", "SHT"] 意味着在中途 MKK 需要出闸再入闸
  };
}