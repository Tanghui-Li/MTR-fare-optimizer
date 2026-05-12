import { useEffect, useState } from 'react';
import { Popup } from 'react-leaflet';
import { fetchLrtSchedule, LrtPlatform } from '../services/mtrApi';
import { Locale } from '../types';
import { t } from '../i18n';

interface LRTPopupProps {
  stationId: string;
  stationName: string;
  locale: Locale;
}

export default function LRTPopup({ stationId, stationName, locale }: LRTPopupProps) {
  const [platforms, setPlatforms] = useState<LrtPlatform[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        // Ensure stationId is treated as a clean string without redundant padding if needed, 
        // though our curl showed 015 works.
        const data = await fetchLrtSchedule(stationId);
        if (isMounted) {
          setPlatforms(data.platform_list || []);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(locale === 'en' ? 'Unable to load live data' : locale === 'zh-Hans' ? '无法加载实时数据' : '無法載入即時資料');
          setLoading(false);
        }
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [stationId, locale]);

  return (
    <Popup 
      className="lrt-popup" 
      minWidth={280} 
      maxWidth={280}
    >
      <div className="lrt-popup-content">
        <div className="lrt-popup-header">
          <span className="lrt-badge">{t(locale, 'lightRail')}</span>
          <span className="lrt-station-name">{stationName}</span>
        </div>

        {loading ? (
          <div className="popup-loading">
            <div className="popup-loading-spinner"></div>
            <span>{t(locale, 'loading')}</span>
          </div>
        ) : error ? (
          <div className="popup-error">{error}</div>
        ) : platforms.length === 0 ? (
          <div className="popup-no-data">{t(locale, 'noData')}</div>
        ) : (
          <div className="lrt-platform-list">
            {platforms.map((plat) => (
              <div key={plat.platform_id} className="lrt-platform-item">
                <div className="lrt-platform-title">{locale === 'en' ? 'Platform' : locale === 'zh-Hans' ? '月台' : '月台'} {plat.platform_id}</div>
                <div className="lrt-train-list">
                  {plat.route_list?.map((train, idx) => (
                    <div key={`${train.route_no}-${idx}`} className="lrt-train-item">
                      <div className="lrt-train-main">
                        <span className="lrt-route-no">{train.route_no}</span>
                        <span className="lrt-dest">{locale === 'en' ? train.dest_en : train.dest_ch}</span>
                      </div>
                      <span className="lrt-time">{locale === 'en' ? train.time_en : train.time_ch}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Popup>
  );
}
