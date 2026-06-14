import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Shuffle, Heart, Footprints, Trash2, Compass } from 'lucide-react';
import { Locale, Poi, PoiCategory, PoiSort } from '../types';
import { NearbyResult } from '../hooks/useNearbyPois';
import { getPoiVisual, getPoiVisualLabel } from '../data/cuisineMap';
import { localizedPoiName } from '../utils/poi';
import { t } from '../i18n';
import PoiCard from './PoiCard';

interface NearbyPanelProps {
  open: boolean;
  stationName: string;
  stationSecondary: string;
  locale: Locale;
  result: NearbyResult;
  category: PoiCategory;
  cuisine: string | null;
  radius: number;
  sort: PoiSort;
  expandedPoiId: string | null;
  activePoiId: string | null;
  favorites: Set<string>;
  tourPois: Poi[];
  tourTotalMin: number;
  onCategory: (c: PoiCategory) => void;
  onCuisine: (key: string | null) => void;
  onRadius: (r: number) => void;
  onSort: (s: PoiSort) => void;
  onToggleExpand: (id: string) => void;
  onLocate: (poi: Poi) => void;
  onToggleFavorite: (id: string) => void;
  onToggleTour: (id: string) => void;
  onClearTour: () => void;
  onShuffle: (list: Poi[]) => void;
  onClose: () => void;
}

export default function NearbyPanel(props: NearbyPanelProps) {
  const {
    open, stationName, stationSecondary, locale, result,
    category, cuisine, radius, sort, expandedPoiId, activePoiId,
    favorites, tourPois, tourTotalMin,
    onCategory, onCuisine, onRadius, onSort, onToggleExpand, onLocate,
    onToggleFavorite, onToggleTour, onClearTour, onShuffle, onClose,
  } = props;

  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const display = useMemo(() => {
    if (!favoritesOnly) return result.filtered;
    return result.filtered.filter((p) => favorites.has(p.id));
  }, [result.filtered, favoritesOnly, favorites]);

  // 当前筛选下、在抓取范围(≤800m)内但超出当前半径的地点 —— 用于"扩大半径可见"提示
  const expandable = useMemo(() => {
    let pool = result.all;
    if (favoritesOnly) pool = pool.filter((p) => favorites.has(p.id));
    if (category !== 'all') pool = pool.filter((p) => p.type === category);
    if (cuisine) pool = pool.filter((p) => p.cuisineKey === cuisine);
    const beyond = pool.filter((p) => p.distanceM > radius);
    if (beyond.length === 0) return null;
    const maxDist = Math.max(...beyond.map((p) => p.distanceM));
    const target = Math.min(800, Math.ceil(maxDist / 50) * 50);
    return { count: beyond.length, target };
  }, [result.all, favoritesOnly, favorites, category, cuisine, radius]);

  // 选中项滚动进可视区
  useEffect(() => {
    if (!activePoiId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-poi-id="${CSS.escape(activePoiId)}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activePoiId, expandedPoiId]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const favCount = favorites.size;

  const categories: { key: PoiCategory; label: string; count: number }[] = [
    { key: 'all', label: t(locale, 'nearbyAll'), count: result.counts.all },
    { key: 'food', label: t(locale, 'nearbyFood'), count: result.counts.food },
    { key: 'attraction', label: t(locale, 'nearbyAttraction'), count: result.counts.attraction },
  ];

  return (
    <aside
      className={`nearby-panel${open ? ' open' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-label={t(locale, 'nearbyTitle')}
      aria-hidden={!open}
    >
      {/* 头部 */}
      <header className="nearby-header">
        <div className="nearby-header-titles">
          <span className="nearby-eyebrow">
            <Compass className="nearby-eyebrow-icon" aria-hidden="true" />
            {t(locale, 'nearbyTitle')}
          </span>
          <h2 className="nearby-station-name">{stationName}</h2>
          {stationSecondary && <span className="nearby-station-sub">{stationSecondary}</span>}
        </div>
        <button
          type="button"
          className="nearby-close"
          onClick={onClose}
          aria-label={t(locale, 'nearbyClose')}
        >
          <X className="nearby-close-icon" aria-hidden="true" />
        </button>
      </header>

      {/* 控制区 */}
      <div className="nearby-controls">
        <div className="nearby-segment" role="tablist" aria-label={t(locale, 'nearbyTitle')}>
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={category === c.key}
              className={`nearby-segment-btn${category === c.key ? ' active' : ''}`}
              onClick={() => onCategory(c.key)}
            >
              {c.label}
              <span className="nearby-segment-count">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="nearby-row">
          <div className="nearby-sort" role="group" aria-label={t(locale, 'nearbySortRecommend')}>
            {(['recommend', 'distance', 'rating'] as PoiSort[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`nearby-sort-btn${sort === s ? ' active' : ''}`}
                aria-pressed={sort === s}
                onClick={() => onSort(s)}
              >
                {s === 'recommend'
                  ? t(locale, 'nearbySortRecommend')
                  : s === 'distance'
                    ? t(locale, 'nearbySortDistance')
                    : t(locale, 'nearbySortRating')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="nearby-icon-btn"
            onClick={() => onShuffle(display)}
            disabled={display.length === 0}
            title={t(locale, 'nearbyShuffle')}
            aria-label={t(locale, 'nearbyShuffle')}
          >
            <Shuffle className="nearby-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`nearby-icon-btn${favoritesOnly ? ' active' : ''}`}
            onClick={() => setFavoritesOnly((v) => !v)}
            disabled={favCount === 0 && !favoritesOnly}
            title={t(locale, 'nearbyFavorites')}
            aria-label={t(locale, 'nearbyFavorites')}
            aria-pressed={favoritesOnly}
          >
            <Heart className="nearby-icon" aria-hidden="true" />
            {favCount > 0 && <span className="nearby-icon-badge">{favCount}</span>}
          </button>
        </div>

        <label className="nearby-radius">
          <span className="nearby-radius-label">
            {t(locale, 'nearbyRadius')}
            <strong>{radius}m</strong>
          </span>
          <input
            type="range"
            min={200}
            max={800}
            step={50}
            value={radius}
            onChange={(e) => onRadius(Number(e.target.value))}
            aria-label={t(locale, 'nearbyRadius')}
          />
        </label>

        {category !== 'attraction' && result.cuisines.length > 0 && (
          <div className="nearby-cuisines" role="group" aria-label={t(locale, 'nearbyFood')}>
            <button
              type="button"
              className={`nearby-cuisine-chip${cuisine === null ? ' active' : ''}`}
              onClick={() => onCuisine(null)}
            >
              {t(locale, 'nearbyAll')}
            </button>
            {result.cuisines.map(({ key, count }) => {
              const v = getPoiVisual('food', key, '');
              return (
                <button
                  key={key}
                  type="button"
                  className={`nearby-cuisine-chip${cuisine === key ? ' active' : ''}`}
                  onClick={() => onCuisine(cuisine === key ? null : key)}
                >
                  <span aria-hidden="true">{v.emoji}</span>
                  {getPoiVisualLabel(v, locale)}
                  <span className="nearby-cuisine-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 列表 */}
      <div className="nearby-list" ref={listRef}>
        <div className="nearby-list-status" role="status" aria-live="polite">
          {display.length} {t(locale, 'nearbyResultsUnit')}
        </div>
        {display.length === 0 ? (
          <div className="nearby-empty">
            <span className="nearby-empty-emoji" aria-hidden="true">🧭</span>
            {expandable ? (
              <>
                <p>{t(locale, 'nearbyEmptyInRadius')}</p>
                <button
                  type="button"
                  className="nearby-expand-btn"
                  onClick={() => onRadius(expandable.target)}
                >
                  {t(locale, 'nearbyExpandTo')} {expandable.target}m → {expandable.count} {t(locale, 'nearbyResultsUnit')}
                </button>
              </>
            ) : (
              <p>{result.hasData ? t(locale, 'nearbyNoMatch') : t(locale, 'nearbyEmpty')}</p>
            )}
          </div>
        ) : (
          display.map((poi, i) => (
            <PoiCard
              key={poi.id}
              poi={poi}
              index={i}
              locale={locale}
              expanded={expandedPoiId === poi.id}
              selected={activePoiId === poi.id}
              isFavorite={favorites.has(poi.id)}
              inTour={tourPois.some((p) => p.id === poi.id)}
              onToggleExpand={onToggleExpand}
              onLocate={onLocate}
              onToggleFavorite={onToggleFavorite}
              onToggleTour={onToggleTour}
            />
          ))
        )}
      </div>

      {/* 逛吃路线条 */}
      {tourPois.length > 0 && (
        <div className="nearby-tour">
          <div className="nearby-tour-head">
            <span className="nearby-tour-title">
              <Footprints className="nearby-tour-icon" aria-hidden="true" />
              {t(locale, 'nearbyTour')}
              <span className="nearby-tour-total">
                {tourPois.length} · ~{tourTotalMin}{t(locale, 'nearbyMinutes')}
              </span>
            </span>
            <button
              type="button"
              className="nearby-tour-clear"
              onClick={onClearTour}
              aria-label={t(locale, 'nearbyClearTour')}
            >
              <Trash2 className="nearby-tour-clear-icon" aria-hidden="true" />
            </button>
          </div>
          <div className="nearby-tour-chips">
            {tourPois.map((poi, i) => (
              <button
                key={poi.id}
                type="button"
                className="nearby-tour-chip"
                onClick={() => onLocate(poi)}
                title={localizedPoiName(poi, locale)}
              >
                <span className="nearby-tour-chip-idx">{i + 1}</span>
                {localizedPoiName(poi, locale)}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
