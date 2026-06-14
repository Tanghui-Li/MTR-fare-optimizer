import { Locale, Poi } from '../types';

/** POI 主名称（按语言回退） */
export function localizedPoiName(poi: Poi, locale: Locale): string {
  if (locale === 'en') return poi.name.en || poi.name.default;
  return poi.name.zh || poi.name.default;
}

/** POI 次要名称（中文界面显示英文名，英文界面显示中文名；无则为空） */
export function localizedPoiSecondary(poi: Poi, locale: Locale): string {
  const primary = localizedPoiName(poi, locale);
  const candidate = locale === 'en' ? poi.name.zh : poi.name.en;
  if (!candidate || candidate === primary) return '';
  return candidate;
}

/** POI 真实简介（按语言回退）；无收录则返回空串 */
export function localizedPoiDescription(poi: Poi, locale: Locale): string {
  const d = poi.description;
  if (!d) return '';
  if (locale === 'en') return d.en || d.zh || '';
  return d.zh || d.en || '';
}

/** 推荐分映射为 0-5 的整数星条（仅用于"信息完整度"可视化，非真实评分） */
export function recommendBars(score: number, featured: boolean): number {
  if (featured) return 5;
  // info_score 上限约 19，叠加距离项约 25；归一到 1-5
  const v = Math.round((score / 9) );
  return Math.max(1, Math.min(5, v));
}
