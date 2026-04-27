// types.ts

/**
 * 站点中英文映射元数据 (来源于 stations.json)
 */
export interface StationMetadata {
  zh: string;
  en: string;
}

export interface StationMap {
  [stationId: string]: StationMetadata;
}

/**
 * 票价矩阵网络 (来源于 fare_matrix.json)
 */
export interface FareMatrix {
  [originId: string]: {
    [destinationId: string]: number;
  };
}

/**
 * 后端/算法返回的最优路线结果
 */
export interface RouteResult {
  totalFare: number;
  route: string[]; // 按顺序排列的 Station ID 数组，例如 ["CEN", "MKK", "SHT"]
}

export type TicketType = 'octopus' | 'single';

export interface UnifiedFareMatrix {
  octopus: FareMatrix;
  single: FareMatrix;
}

/**
 * 用于前端 HCI 渲染分段明细的接口
 * 帮助 Agent 拆解 route 数组，用于在 UI 上展示“出闸再入闸”的省钱明细
 */
export interface RouteSegment {
  fromId: string;
  toId: string;
  fare: number;
}