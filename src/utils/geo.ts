/**
 * 地理计算工具（WGS84）
 * 用于「周边探索」的距离与步行时长估算。
 */

const EARTH_RADIUS_M = 6371000;
const WALK_M_PER_MIN = 80; // 平均步行速度约 4.8 km/h

/** 两点间大圆距离（米） */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const phi1 = (aLat * Math.PI) / 180;
  const phi2 = (bLat * Math.PI) / 180;
  const dPhi = ((bLat - aLat) * Math.PI) / 180;
  const dLambda = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 距离（米）换算步行分钟，至少 1 分钟 */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

/** 稳定哈希：同一字符串永远得到同一非负整数（用于占位图轮换） */
export function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
