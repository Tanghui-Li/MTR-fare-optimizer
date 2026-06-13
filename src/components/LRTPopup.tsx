import { useCallback, useEffect, useRef, useState } from 'react';
import { Popup } from 'react-leaflet';
import { fetchLrtSchedule, LrtPlatform } from '../services/mtrApi';
import { Locale } from '../types';
import { t } from '../i18n';

interface LRTPopupProps {
  stationId: string;
  stationName: string;
  locale: Locale;
}

interface LRTDetailsProps extends LRTPopupProps {
  isActive: boolean;
}

export function LRTDetails({ stationId, stationName, locale, isActive }: LRTDetailsProps) {
  const [platforms, setPlatforms] = useState<LrtPlatform[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const isActiveRef = useRef(isActive);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) {
      requestSeqRef.current += 1;
      setLoading(false);
    }
  }, [isActive]);

  useEffect(() => {
    requestSeqRef.current += 1;
    setPlatforms([]);
    setError(null);
    setLastUpdated('');
  }, [stationId]);

  const load = useCallback(async () => {
    if (!isActiveRef.current) return;

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchLrtSchedule(stationId);
      if (isActiveRef.current && requestSeqRef.current === requestSeq) {
        setPlatforms(data.platform_list || []);
        setLastUpdated(new Date().toLocaleTimeString(locale === 'en' ? 'en-GB' : 'zh-HK'));
      }
    } catch (err) {
      if (isActiveRef.current && requestSeqRef.current === requestSeq) {
        setError(locale === 'en' ? 'Unable to load live data' : locale === 'zh-Hans' ? '无法加载实时数据' : '無法載入即時資料');
      }
    } finally {
      if (isActiveRef.current && requestSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  }, [stationId, locale]);

  useEffect(() => {
    if (!isActive) return;
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(interval);
  }, [isActive, load]);

  return (
    <div className="lrt-popup-content">
      <div className="lrt-popup-header">
        <span className="lrt-badge">{t(locale, 'lightRail')}</span>
        <span className="lrt-station-name">{stationName}</span>
      </div>

      {loading && platforms.length === 0 ? (
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

      {isActive && (
        <div className="popup-footer">
          <span className="popup-update-time">{lastUpdated ? `${t(locale, 'updated')}: ${lastUpdated}` : ''}</span>
          <button type="button" className="popup-refresh-btn" onClick={load} disabled={loading}>
            {loading ? '⟳' : `↻ ${t(locale, 'refresh')}`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LRTPopup({ stationId, stationName, locale }: LRTPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popup
      className="lrt-popup"
      minWidth={280}
      maxWidth={280}
      eventHandlers={{
        add: () => setIsOpen(true),
        remove: () => setIsOpen(false),
      }}
    >
      <LRTDetails
        stationId={stationId}
        stationName={stationName}
        locale={locale}
        isActive={isOpen}
      />
    </Popup>
  );
}
