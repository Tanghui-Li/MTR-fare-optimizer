// types.ts

/**
 * 站点中英文映射元数据 (来源于 stations.json)
 */
export interface StationMetadata {
  zh: string;
  en: string;
  zhHans?: string;
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
  segments?: DetailedSegment[];
}

export type TicketType = 'octopus' | 'single';
export type Locale = 'zh-Hant' | 'en' | 'zh-Hans';
export type TransportMode = 'MTR' | 'AEL' | 'LRT' | 'NWBUS' | 'TAIPOBUS' | 'TRANSFER';
export type RouteOptimizationGoal = 'fare' | 'balanced' | 'time';
export type AccessibilityRouteMode = 'off' | 'prefer' | 'require';

export interface RoutePlanningPreferences {
  goal: RouteOptimizationGoal;
  accessibilityMode: AccessibilityRouteMode;
  accessibilityFilter: string[][];
  maxGateChanges: number | null;
  minSavings: number;
}

export interface RouteMetrics {
  fare: number;
  estimatedMinutes: number;
  gateChanges: number;
  transferCount: number;
  stationCount: number;
  accessibilityMatchedStops: number;
  accessibilityProblemStops: number;
  accessibilityScore: number;
  score: number;
}

export interface RouteInsight {
  selectedReason: string;
  tradeoffNotes: string[];
  metrics: RouteMetrics;
  alternatives: {
    lowestFare?: RouteMetrics;
    regular?: RouteMetrics;
    fastest?: RouteMetrics;
    balanced?: RouteMetrics;
  };
  suppressedSavings: boolean;
  accessibilityMode: AccessibilityRouteMode;
}

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

/** 路径中的一步（站+所乘线路） */
export interface PathStep {
  stationId: string;
  lineCode: string;  // 乘坐哪条线到达/离开此站（首站为出发线路）
  mode?: TransportMode;
}

/** 一段完整路径（两次出入闸之间） */
export interface DetailedSegment {
  from: string;        // 入闸站 ID
  to: string;          // 出闸站 ID
  fare: number;
  path: PathStep[];    // 站间详细路径（含所有途经站）
  lineLabel?: string;
  mode?: TransportMode;
}

export interface GraphEdge {
  from: string;
  to: string;
  fare: number;
  mode: TransportMode;
  lineCode: string;
  busKey?: string;
  estimatedMinutes?: number;
}

export interface GraphState {
  nodeId: string;
  usedMask: number;
  totalFare: number;
  previousKey: string | null;
  viaEdge: GraphEdge | null;
}

/**
 * 周边探索 POI（来源：OpenStreetMap，构建期生成至 data/pois.json）
 */
export interface Poi {
  id: string;
  type: 'food' | 'attraction';
  kind: string; // OSM amenity / tourism 原始值
  name: { default: string; en: string; zh: string };
  cuisineKey: string;
  lat: number;
  lng: number;
  distanceM: number;
  walkMin: number;
  score: number;
  featured: boolean;
  website: string;
  phone: string;
  openingHours: string;
}

export type PoiCategory = 'all' | 'food' | 'attraction';
export type PoiSort = 'recommend' | 'distance';
