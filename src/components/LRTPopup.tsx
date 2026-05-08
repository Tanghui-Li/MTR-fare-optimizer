import { useEffect, useState } from 'react';
import { Popup } from 'react-leaflet';
import { fetchLrtSchedule, LrtPlatform } from '../services/mtrApi';

interface LRTPopupProps {
  stationId: string;
  stationName: string;
}

export default function LRTPopup({ stationId, stationName }: LRTPopupProps) {
  const [platforms, setPlatforms] = useState<LrtPlatform[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;

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
          setError('无法加载实时数据');
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
  }, [stationId, active]);

  return (
    <Popup 
      className="lrt-popup" 
      minWidth={280} 
      maxWidth={280}
      eventHandlers={{
        add: () => setActive(true),
        remove: () => setActive(false)
      }}
    >
      <div className="lrt-popup-content">
        <div className="lrt-popup-header">
          <span className="lrt-badge">輕鐵</span>
          <span className="lrt-station-name">{stationName}</span>
        </div>

        {loading ? (
          <div className="popup-loading">
            <div className="popup-loading-spinner"></div>
            <span>載入中...</span>
          </div>
        ) : error ? (
          <div className="popup-error">{error}</div>
        ) : platforms.length === 0 ? (
          <div className="popup-no-data">暫无班次信息</div>
        ) : (
          <div className="lrt-platform-list">
            {platforms.map((plat) => (
              <div key={plat.platform_id} className="lrt-platform-item">
                <div className="lrt-platform-title">月台 {plat.platform_id}</div>
                <div className="lrt-train-list">
                  {plat.route_list?.map((train, idx) => (
                    <div key={`${train.route_no}-${idx}`} className="lrt-train-item">
                      <div className="lrt-train-main">
                        <span className="lrt-route-no">{train.route_no}</span>
                        <span className="lrt-dest">{train.dest_ch}</span>
                      </div>
                      <span className="lrt-time">{train.time_ch}</span>
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
