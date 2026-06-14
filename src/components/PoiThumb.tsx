import { useState } from 'react';
import { Poi } from '../types';
import { getPoiVisual } from '../data/cuisineMap';
import { stableHash } from '../utils/geo';

interface PoiThumbProps {
  poi: Poi;
  size: number;
  rounded?: number;
  showEmoji?: boolean;
  /** 通栏模式：宽度占满父容器，高度为 size */
  fluid?: boolean;
}

/** 拼接 public/ 下的图片地址（兼容非根 base 部署） */
function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

/**
 * POI 缩略图：
 * - 若有真实照片（Wikidata / 维基百科 / Wikimedia Commons，版权干净），优先显示，懒加载淡入；
 * - 无照片或加载失败时，回退到按菜系/类别确定性着色的渐变 + emoji 占位图，
 *   同一店铺永远得到同一外观（hash 微调色相），既稳定又有变化。
 */
export default function PoiThumb({ poi, size, rounded = 12, showEmoji = true, fluid = false }: PoiThumbProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const visual = getPoiVisual(poi.type, poi.cuisineKey, poi.kind);
  const jitter = (stableHash(poi.id) % 24) - 12; // -12..+11 色相微扰
  const hue = (visual.hue + jitter + 360) % 360;
  const sat = poi.type === 'food' ? 68 : 55;

  const background = `linear-gradient(135deg,
    hsl(${hue} ${sat}% 90%) 0%,
    hsl(${(hue + 18) % 360} ${sat}% 80%) 55%,
    hsl(${(hue + 34) % 360} ${sat - 6}% 72%) 100%)`;

  const hasPhoto = Boolean(poi.image) && !imgError;

  return (
    <div
      className={`poi-thumb${hasPhoto ? ' has-photo' : ''}`}
      style={{
        width: fluid ? '100%' : size,
        height: size,
        borderRadius: rounded,
        background,
        fontSize: Math.round((fluid ? size * 0.7 : size) * 0.46),
      }}
      aria-hidden="true"
    >
      {hasPhoto && (
        <img
          className={`poi-thumb-img${imgLoaded ? ' loaded' : ''}`}
          src={publicUrl(poi.image as string)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      )}
      {(!hasPhoto || !imgLoaded) && showEmoji && (
        <span className="poi-thumb-emoji">{visual.emoji}</span>
      )}
      <span className="poi-thumb-sheen" />
    </div>
  );
}
