import { useMemo } from 'react';
import poisData from '../data/pois.json';
import { Poi, PoiCategory, PoiSort } from '../types';

const POIS = poisData as unknown as Record<string, Poi[]>;

export interface NearbyCuisine {
  key: string;
  count: number;
}

export interface NearbyResult {
  /** 当前站点全部 POI（未筛选） */
  all: Poi[];
  /** 经类别 / 菜系 / 半径筛选并排序后的列表 */
  filtered: Poi[];
  /** 各类别在当前半径内的数量 */
  counts: { all: number; food: number; attraction: number };
  /** 当前半径内出现过的菜系（按数量降序），用于筛选 chips */
  cuisines: NearbyCuisine[];
  /** 该站是否有收录数据 */
  hasData: boolean;
}

export interface NearbyOptions {
  category: PoiCategory;
  cuisine: string | null;
  radius: number;
  sort: PoiSort;
}

export function stationHasPois(stationId: string | null | undefined): boolean {
  if (!stationId) return false;
  const list = POIS[stationId];
  return Array.isArray(list) && list.length > 0;
}

export function useNearbyPois(
  stationId: string | null,
  options: NearbyOptions,
): NearbyResult {
  const { category, cuisine, radius, sort } = options;

  return useMemo(() => {
    const all = (stationId && POIS[stationId]) || [];
    const withinRadius = all.filter((p) => p.distanceM <= radius);

    const counts = {
      all: withinRadius.length,
      food: withinRadius.filter((p) => p.type === 'food').length,
      attraction: withinRadius.filter((p) => p.type === 'attraction').length,
    };

    // 菜系 chips：基于半径内的美食项统计
    const cuisineCount = new Map<string, number>();
    for (const p of withinRadius) {
      if (p.type === 'food' && p.cuisineKey) {
        cuisineCount.set(p.cuisineKey, (cuisineCount.get(p.cuisineKey) || 0) + 1);
      }
    }
    const cuisines: NearbyCuisine[] = Array.from(cuisineCount.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    let filtered = withinRadius;
    if (category !== 'all') {
      filtered = filtered.filter((p) => p.type === category);
    }
    if (cuisine) {
      filtered = filtered.filter((p) => p.cuisineKey === cuisine);
    }

    filtered = [...filtered].sort((a, b) => {
      if (sort === 'distance') {
        return a.distanceM - b.distanceM || b.score - a.score;
      }
      return b.score - a.score || a.distanceM - b.distanceM;
    });

    return { all, filtered, counts, cuisines, hasData: all.length > 0 };
  }, [stationId, category, cuisine, radius, sort]);
}
