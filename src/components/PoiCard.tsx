import { MapPin, Heart, Plus, Minus, Clock, Globe, Phone, Star, Footprints } from 'lucide-react';
import { Locale, Poi } from '../types';
import { getPoiVisual, getPoiVisualLabel } from '../data/cuisineMap';
import { localizedPoiName, localizedPoiSecondary, recommendBars } from '../utils/poi';
import { t } from '../i18n';
import PoiThumb from './PoiThumb';

interface PoiCardProps {
  poi: Poi;
  index: number;
  locale: Locale;
  expanded: boolean;
  selected: boolean;
  isFavorite: boolean;
  inTour: boolean;
  onToggleExpand: (id: string) => void;
  onLocate: (poi: Poi) => void;
  onToggleFavorite: (id: string) => void;
  onToggleTour: (id: string) => void;
}

function buildIntro(poi: Poi, label: string, locale: Locale): string {
  const { distanceM, walkMin } = poi;
  if (locale === 'en') {
    const article = poi.type === 'food' ? 'eatery' : 'spot';
    return `A ${label.toLowerCase()} ${article} about a ${walkMin}-min walk (${distanceM} m) from the station.`;
  }
  if (locale === 'zh-Hans') {
    return `${label}，由车站步行约 ${walkMin} 分钟（约 ${distanceM} 米）即达。`;
  }
  return `${label}，由車站步行約 ${walkMin} 分鐘（約 ${distanceM} 米）即達。`;
}

export default function PoiCard({
  poi, index, locale, expanded, selected, isFavorite, inTour,
  onToggleExpand, onLocate, onToggleFavorite, onToggleTour,
}: PoiCardProps) {
  const visual = getPoiVisual(poi.type, poi.cuisineKey, poi.kind);
  const label = getPoiVisualLabel(visual, locale);
  const name = localizedPoiName(poi, locale);
  const secondary = localizedPoiSecondary(poi, locale);
  const bars = recommendBars(poi.score, poi.featured);
  const intro = buildIntro(poi, label, locale);

  return (
    <article
      className={`poi-card${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}`}
      style={{ ['--poi-delay' as string]: `${Math.min(index, 12) * 35}ms` }}
      data-poi-id={poi.id}
    >
      <button
        type="button"
        className="poi-card-main"
        onClick={() => onToggleExpand(poi.id)}
        aria-expanded={expanded}
      >
        <PoiThumb poi={poi} size={68} />
        <div className="poi-card-body">
          <div className="poi-card-titlerow">
            <span className="poi-card-name">{name}</span>
            {poi.featured && (
              <span className="poi-badge featured">
                <Star className="poi-badge-icon" aria-hidden="true" />
                {t(locale, 'nearbyFeatured')}
              </span>
            )}
          </div>
          {secondary && <span className="poi-card-sub">{secondary}</span>}
          <div className="poi-card-meta">
            <span className={`poi-chip ${poi.type}`}>
              <span aria-hidden="true">{visual.emoji}</span>
              {label}
            </span>
            <span className="poi-card-walk">
              <Footprints className="poi-meta-icon" aria-hidden="true" />
              {poi.distanceM}m · {poi.walkMin}{t(locale, 'nearbyMinutes')}
            </span>
          </div>
          <span
            className="poi-rec"
            role="img"
            aria-label={`${t(locale, 'nearbyRecommendLabel')} ${bars}/5`}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`poi-rec-bar${i < bars ? ' on' : ''}`} />
            ))}
          </span>
        </div>
      </button>

      <button
        type="button"
        className={`poi-fav${isFavorite ? ' on' : ''}`}
        onClick={() => onToggleFavorite(poi.id)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? t(locale, 'nearbyUnfavorite') : t(locale, 'nearbyFavorite')}
        title={isFavorite ? t(locale, 'nearbyUnfavorite') : t(locale, 'nearbyFavorite')}
      >
        <Heart className="poi-fav-icon" aria-hidden="true" />
      </button>

      {expanded && (
        <div className="poi-card-detail">
          <div className="poi-hero">
            <PoiThumb poi={poi} size={132} rounded={14} fluid />
            <span className="poi-hero-note">{t(locale, 'nearbyThumbNote')}</span>
          </div>
          <p className="poi-intro">{intro}</p>
          {poi.openingHours && (
            <div className="poi-fact">
              <Clock className="poi-fact-icon" aria-hidden="true" />
              <span className="poi-fact-text">{poi.openingHours}</span>
            </div>
          )}
          <div className="poi-actions">
            <button type="button" className="poi-action primary" onClick={() => onLocate(poi)}>
              <MapPin className="poi-action-icon" aria-hidden="true" />
              {t(locale, 'nearbyLocate')}
            </button>
            <button
              type="button"
              className={`poi-action${inTour ? ' active' : ''}`}
              onClick={() => onToggleTour(poi.id)}
              aria-pressed={inTour}
            >
              {inTour ? <Minus className="poi-action-icon" aria-hidden="true" /> : <Plus className="poi-action-icon" aria-hidden="true" />}
              {inTour ? t(locale, 'nearbyRemoveFromTour') : t(locale, 'nearbyAddToTour')}
            </button>
            {poi.website && (
              <a className="poi-action" href={poi.website} target="_blank" rel="noopener noreferrer">
                <Globe className="poi-action-icon" aria-hidden="true" />
                {t(locale, 'nearbyWebsite')}
              </a>
            )}
            {poi.phone && (
              <a className="poi-action" href={`tel:${poi.phone.replace(/\s/g, '')}`}>
                <Phone className="poi-action-icon" aria-hidden="true" />
                {t(locale, 'nearbyPhone')}
              </a>
            )}
          </div>
          <div className="poi-source">
            {t(locale, 'nearbySource')}: OpenStreetMap
          </div>
        </div>
      )}
    </article>
  );
}
