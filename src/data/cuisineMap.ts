/**
 * 菜系 / 景点类别 -> 本地化名称 + emoji + 主色相
 * 用于「周边探索」卡片标签、占位缩略图配色、地图标记图标。
 *
 * cuisineKey 由 scripts/build_pois.py 归一化产出；kind 为 OSM 原始 amenity/tourism。
 */

import { Locale } from '../types';

export interface PoiVisual {
  emoji: string;
  /** 0-360 色相，用于生成柔和渐变缩略图 */
  hue: number;
  zh: string; // 繁體
  en: string;
  zhHans: string; // 简体
}

const FOOD: Record<string, PoiVisual> = {
  chinese: { emoji: '🥢', hue: 5, zh: '中菜', en: 'Chinese', zhHans: '中菜' },
  dimsum: { emoji: '🥟', hue: 25, zh: '點心', en: 'Dim Sum', zhHans: '点心' },
  hotpot: { emoji: '🍲', hue: 0, zh: '火鍋', en: 'Hotpot', zhHans: '火锅' },
  noodle: { emoji: '🍜', hue: 30, zh: '麵食', en: 'Noodles', zhHans: '面食' },
  ramen: { emoji: '🍜', hue: 18, zh: '拉麵', en: 'Ramen', zhHans: '拉面' },
  sushi: { emoji: '🍣', hue: 200, zh: '壽司', en: 'Sushi', zhHans: '寿司' },
  japanese: { emoji: '🍱', hue: 210, zh: '日式', en: 'Japanese', zhHans: '日式' },
  korean: { emoji: '🍚', hue: 345, zh: '韓式', en: 'Korean', zhHans: '韩式' },
  thai: { emoji: '🍛', hue: 280, zh: '泰式', en: 'Thai', zhHans: '泰式' },
  vietnamese: { emoji: '🍜', hue: 150, zh: '越式', en: 'Vietnamese', zhHans: '越式' },
  indian: { emoji: '🍛', hue: 35, zh: '印度菜', en: 'Indian', zhHans: '印度菜' },
  italian: { emoji: '🍝', hue: 110, zh: '意式', en: 'Italian', zhHans: '意式' },
  pizza: { emoji: '🍕', hue: 15, zh: '薄餅', en: 'Pizza', zhHans: '披萨' },
  french: { emoji: '🥐', hue: 45, zh: '法式', en: 'French', zhHans: '法式' },
  western: { emoji: '🍽️', hue: 220, zh: '西餐', en: 'Western', zhHans: '西餐' },
  american: { emoji: '🍔', hue: 40, zh: '美式', en: 'American', zhHans: '美式' },
  burger: { emoji: '🍔', hue: 38, zh: '漢堡', en: 'Burger', zhHans: '汉堡' },
  steak: { emoji: '🥩', hue: 355, zh: '扒房', en: 'Steakhouse', zhHans: '扒房' },
  seafood: { emoji: '🦞', hue: 190, zh: '海鮮', en: 'Seafood', zhHans: '海鲜' },
  vegetarian: { emoji: '🥗', hue: 130, zh: '素食', en: 'Vegetarian', zhHans: '素食' },
  cafe: { emoji: '☕', hue: 28, zh: '咖啡', en: 'Café', zhHans: '咖啡' },
  dessert: { emoji: '🍰', hue: 320, zh: '甜品', en: 'Dessert', zhHans: '甜品' },
  bakery: { emoji: '🥖', hue: 42, zh: '麵包', en: 'Bakery', zhHans: '面包' },
  tea: { emoji: '🧋', hue: 95, zh: '茶飲', en: 'Tea', zhHans: '茶饮' },
  bbq: { emoji: '🍖', hue: 12, zh: '燒烤', en: 'BBQ', zhHans: '烧烤' },
  asian: { emoji: '🍲', hue: 165, zh: '亞洲菜', en: 'Asian', zhHans: '亚洲菜' },
  international: { emoji: '🍽️', hue: 235, zh: '多國菜', en: 'International', zhHans: '多国菜' },
  fastfood: { emoji: '🍟', hue: 48, zh: '快餐', en: 'Fast Food', zhHans: '快餐' },
};

const ATTRACTION: Record<string, PoiVisual> = {
  attraction: { emoji: '📸', hue: 160, zh: '景點', en: 'Attraction', zhHans: '景点' },
  museum: { emoji: '🏛️', hue: 250, zh: '博物館', en: 'Museum', zhHans: '博物馆' },
  viewpoint: { emoji: '🌃', hue: 215, zh: '觀景點', en: 'Viewpoint', zhHans: '观景点' },
  gallery: { emoji: '🖼️', hue: 290, zh: '藝廊', en: 'Gallery', zhHans: '艺廊' },
  artwork: { emoji: '🎨', hue: 300, zh: '藝術', en: 'Artwork', zhHans: '艺术' },
  theme_park: { emoji: '🎢', hue: 330, zh: '主題樂園', en: 'Theme Park', zhHans: '主题乐园' },
  zoo: { emoji: '🦒', hue: 100, zh: '動物園', en: 'Zoo', zhHans: '动物园' },
  aquarium: { emoji: '🐠', hue: 195, zh: '水族館', en: 'Aquarium', zhHans: '水族馆' },
};

const DEFAULT_FOOD: PoiVisual = { emoji: '🍽️', hue: 18, zh: '餐廳', en: 'Restaurant', zhHans: '餐厅' };
const DEFAULT_ATTRACTION: PoiVisual = ATTRACTION.attraction;

export function getPoiVisual(type: 'food' | 'attraction', key: string, kind: string): PoiVisual {
  if (type === 'food') {
    return FOOD[key] || DEFAULT_FOOD;
  }
  return ATTRACTION[kind] || DEFAULT_ATTRACTION;
}

export function getPoiVisualLabel(visual: PoiVisual, locale: Locale): string {
  if (locale === 'en') return visual.en;
  if (locale === 'zh-Hans') return visual.zhHans;
  return visual.zh;
}
