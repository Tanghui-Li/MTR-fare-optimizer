import { useEffect, useState, useCallback, useMemo } from 'react';
import { Popup } from 'react-leaflet';
import { fetchNextTrain, NextTrainEntry, stationCodeToId, stationIdToCode } from '../services/mtrApi';
import { lineColors, getLocalizedLineName } from '../data/lineColors';
import { StationMetadata, Locale, StationMap } from '../types';
import accessibilityRaw from '../data/accessibilityData.json';
import { t } from '../i18n';
import stationsData from '../data/stations.json';
import { getLocalizedText, getSecondaryLocalizedText } from '../data/zhHansText';

const accessibilityData = accessibilityRaw as {
  facilities: Record<string, Record<string, true | { zh: string; en: string }>>;
  categories: Record<string, { catId: string; catZh: string; catEn: string; zh: string; en: string; order: number }>;
};

// Icons for each category
const categoryIcons: Record<string, string> = {
  AJ: '🚪', // System Accessibility
  MJ: '♿', // Mobility Impaired
  VJ: '👁️', // Visually Impaired
  HJ: '🦻', // Hearing Impaired
};

const categoryOrder = ['AJ', 'MJ', 'VJ', 'HJ'];
const stationCatalog = stationsData as StationMap;

interface StationPopupProps {
  stationId: string;
  station: StationMetadata;
  lines: string[];
  locale: Locale;
}

interface TrainDirection {
  direction: string;
  label: string;
  trains: NextTrainEntry[];
}

export default function StationPopup({ stationId, station, lines, locale }: StationPopupProps) {
  const [trainData, setTrainData] = useState<TrainDirection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadTrainData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const stationCode = stationIdToCode[stationId];
    if (!stationCode) {
      setError(locale === 'en' ? 'Unknown station code' : locale === 'zh-Hans' ? '车站代码未知' : '車站代碼未知');
      setLoading(false);
      return;
    }

    const allDirections: TrainDirection[] = [];

    try {
      // Query each line that passes through this station
      for (const lineCode of lines) {
        const resp = await fetchNextTrain(lineCode, stationCode);
        if (resp.status === 1 && resp.data) {
          const key = `${lineCode}-${stationCode}`;
          const data = resp.data[key];
          if (data) {
            const lineName = getLocalizedLineName(lineCode, locale);
            if (data.UP && data.UP.length > 0) {
              allDirections.push({
                direction: 'UP',
                label: `${lineName} ▲`,
                trains: data.UP.filter(t => t.valid === 'Y').slice(0, 3),
              });
            }
            if (data.DOWN && data.DOWN.length > 0) {
              allDirections.push({
                direction: 'DOWN',
                label: `${lineName} ▼`,
                trains: data.DOWN.filter(t => t.valid === 'Y').slice(0, 3),
              });
            }
          }
        }
      }

      setTrainData(allDirections);
      setLastUpdated(new Date().toLocaleTimeString(locale === 'en' ? 'en-GB' : 'zh-HK'));
    } catch (e) {
      setError(locale === 'en' ? 'Unable to fetch train information' : locale === 'zh-Hans' ? '无法获取列车信息' : '無法獲取列車資訊');
      console.error('Next train fetch error:', e);
    }

    setLoading(false);
  }, [stationId, lines, locale]);

  useEffect(() => {
    loadTrainData();
    const interval = setInterval(loadTrainData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadTrainData]);

  // Get station code for the dest field
  const getDestName = (destCode: string): string => {
    const destStationId = stationCodeToId[destCode];
    const destStation = destStationId ? stationCatalog[destStationId] : undefined;
    if (destStation) {
      return getLocalizedText(destStation, locale);
    }

    const fallback: Record<string, { zh: string; en: string }> = {
      CEN: { zh: '中環', en: 'Central' }, ADM: { zh: '金鐘', en: 'Admiralty' }, TST: { zh: '尖沙咀', en: 'Tsim Sha Tsui' },
      KOW: { zh: '九龍', en: 'Kowloon' }, HOK: { zh: '香港', en: 'Hong Kong' }, TSW: { zh: '荃灣', en: 'Tsuen Wan' },
      CHW: { zh: '柴灣', en: 'Chai Wan' }, KET: { zh: '堅尼地城', en: 'Kennedy Town' }, TIK: { zh: '調景嶺', en: 'Tiu Keng Leng' },
      WHA: { zh: '黃埔', en: 'Whampoa' }, POA: { zh: '寶琳', en: 'Po Lam' }, LHP: { zh: '康城', en: 'LOHAS Park' },
      NOP: { zh: '北角', en: 'North Point' }, TUC: { zh: '東涌', en: 'Tung Chung' }, DIS: { zh: '迪士尼', en: 'Disneyland Resort' },
      LOW: { zh: '羅湖', en: 'Lo Wu' }, LMC: { zh: '落馬洲', en: 'Lok Ma Chau' }, TUM: { zh: '屯門', en: 'Tuen Mun' },
      WKS: { zh: '烏溪沙', en: 'Wu Kai Sha' }, AIR: { zh: '機場', en: 'Airport' }, AWE: { zh: '博覽館', en: 'AsiaWorld-Expo' },
      SOH: { zh: '海怡半島', en: 'South Horizons' }, SUN: { zh: '欣澳', en: 'Sunny Bay' }, TSY: { zh: '青衣', en: 'Tsing Yi' },
    };
    return fallback[destCode] ? getLocalizedText(fallback[destCode], locale) : destCode;
  };

  // Build accessibility info grouped by category
  const accessibilityInfo = useMemo(() => {
    const stationFacilities = accessibilityData.facilities[stationId];
    if (!stationFacilities) return null;

    const grouped: Record<string, {
      catZh: string;
      catEn: string;
      items: { code: string; zh: string; en: string; detail?: { zh: string; en: string } }[];
    }> = {};

    for (const [code, value] of Object.entries(stationFacilities)) {
      const catInfo = accessibilityData.categories[code];
      if (!catInfo) continue;

      const catId = catInfo.catId;
      if (!grouped[catId]) {
        grouped[catId] = {
          catZh: catInfo.catZh,
          catEn: catInfo.catEn,
          items: [],
        };
      }

      const detail = typeof value === 'object' ? value : undefined;
      grouped[catId].items.push({
        code,
        zh: catInfo.zh,
        en: catInfo.en,
        detail,
      });
    }

    return grouped;
  }, [stationId]);

  const hasAccessibility = accessibilityInfo && Object.keys(accessibilityInfo).length > 0;

  return (
    <Popup className="station-popup" maxWidth={480} minWidth={380}>
      <div className="popup-content">
        {/* Station header */}
        <div className="popup-header">
          <h3 className="popup-station-name">{getLocalizedText(station, locale)}</h3>
          {locale !== 'en' && <span className="popup-station-name-en">{getSecondaryLocalizedText(station, locale)}</span>}
          <div className="popup-line-tags">
            {lines.map(line => (
              <span
                key={line}
                className="popup-line-tag"
                style={{ backgroundColor: lineColors[line] || '#666' }}
              >
                {getLocalizedLineName(line, locale)}
              </span>
            ))}
          </div>
        </div>

        {/* Unified scrollable area for all content */}
        <div className="popup-scroll-area">
          {/* Train information */}
          <div className="popup-trains">
            {loading && trainData.length === 0 && (
              <div className="popup-loading">
                <div className="popup-loading-spinner" />
                <span>{t(locale, 'loading')}</span>
              </div>
            )}

            {error && (
              <div className="popup-error">{error}</div>
            )}

            {trainData.map((dir, idx) => (
              <div key={idx} className="popup-direction">
                <div className="popup-direction-label">{dir.label}</div>
                {dir.trains.length === 0 ? (
                  <div className="popup-no-train">{locale === 'en' ? 'No service' : locale === 'zh-Hans' ? '暂无班次' : '暫無班次'}</div>
                ) : (
                  <div className="popup-train-list">
                    {dir.trains.map((train, tidx) => (
                      <div key={tidx} className="popup-train-item">
                        <span className="popup-train-dest">
                          → {getDestName(train.dest)}
                        </span>
                        <span className="popup-train-plat">
                          {locale === 'en' ? `Platform ${train.plat}` : `${train.plat}號月台`}
                        </span>
                        <span className={`popup-train-time ${
                          train.ttnt === '0' || train.ttnt === '-' ? 'arriving' : ''
                        }`}>
                          {train.ttnt === '0' || train.ttnt === '-'
                            ? (locale === 'en' ? 'Arriving' : locale === 'zh-Hans' ? '即将到站' : '即將到站')
                            : locale === 'en' ? `${train.ttnt} min` : `${train.ttnt} 分鐘`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!loading && trainData.length === 0 && !error && (
              <div className="popup-no-train">{locale === 'en' ? 'No train service' : locale === 'zh-Hans' ? '目前没有列车服务' : '目前沒有列車服務'}</div>
            )}
          </div>

          {/* Accessibility Section */}
          {hasAccessibility && (
            <div className="popup-accessibility">
              <div className="popup-accessibility-title" style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#374151', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                ♿ {locale === 'en' ? 'Barrier-free Facilities' : locale === 'zh-Hans' ? '无障碍设施' : '無障礙設施'}
              </div>
              <div className="popup-accessibility-content">
                {categoryOrder.map(catId => {
                  const group = accessibilityInfo![catId];
                  if (!group || group.items.length === 0) return null;
                  return (
                    <div key={catId} className="popup-acc-category">
                      <div className="popup-acc-category-header">
                        <span className="popup-acc-category-icon">{categoryIcons[catId]}</span>
                        <span className="popup-acc-category-name">
                          {locale === 'en' ? group.catEn : getLocalizedText({ zh: group.catZh, en: group.catEn }, locale)}
                        </span>
                      </div>
                      <div className="popup-acc-items">
                        {group.items.map(item => (
                          <div key={item.code} className="popup-acc-item">
                            <span className="popup-acc-check">✓</span>
                            <div className="popup-acc-item-text">
                              <span className="popup-acc-item-name">{getLocalizedText(item, locale)}</span>
                              {item.detail && (item.detail.zh || item.detail.en) && (
                                <span className="popup-acc-item-detail">{getLocalizedText(item.detail, locale)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {lastUpdated && (
          <div className="popup-footer">
            <span className="popup-update-time">{t(locale, 'updated')}: {lastUpdated}</span>
            <button className="popup-refresh-btn" onClick={loadTrainData} disabled={loading}>
              {loading ? '⟳' : `↻ ${t(locale, 'refresh')}`}
            </button>
          </div>
        )}
      </div>
    </Popup>
  );
}
