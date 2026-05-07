import { useEffect, useState, useCallback } from 'react';
import { Popup } from 'react-leaflet';
import { fetchNextTrain, NextTrainEntry, stationIdToCode } from '../services/mtrApi';
import { lineColors, lineNames } from '../data/lineColors';
import { StationMetadata } from '../types';

interface StationPopupProps {
  stationId: string;
  station: StationMetadata;
  lines: string[];
}

interface TrainDirection {
  direction: string;
  label: string;
  trains: NextTrainEntry[];
}

export default function StationPopup({ stationId, station, lines }: StationPopupProps) {
  const [trainData, setTrainData] = useState<TrainDirection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadTrainData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const stationCode = stationIdToCode[stationId];
    if (!stationCode) {
      setError('車站代碼未知');
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
            const lineName = lineNames[lineCode]?.zh || lineCode;
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
      setLastUpdated(new Date().toLocaleTimeString('zh-HK'));
    } catch (e) {
      setError('無法獲取列車資訊');
      console.error('Next train fetch error:', e);
    }

    setLoading(false);
  }, [stationId, lines]);

  useEffect(() => {
    loadTrainData();
    const interval = setInterval(loadTrainData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadTrainData]);

  // Get station code for the dest field
  const getDestName = (destCode: string): string => {
    // Common destination mappings
    const destNames: Record<string, string> = {
      CEN: '中環', ADM: '金鐘', TST: '尖沙咀', KOW: '九龍', HOK: '香港',
      TSW: '荃灣', CHW: '柴灣', KET: '堅尼地城', TIK: '調景嶺', WHA: '黃埔',
      POA: '寶琳', LHP: '康城', NOP: '北角', TUC: '東涌', DIS: '迪士尼',
      LOW: '羅湖', LMC: '落馬洲', TUM: '屯門', WKS: '烏溪沙',
      AIR: '機場', AWE: '博覽館', SOH: '海怡半島',
      SUN: '欣澳', TSY: '青衣',
    };
    return destNames[destCode] || destCode;
  };

  return (
    <Popup className="station-popup" maxWidth={420} minWidth={340}>
      <div className="popup-content">
        {/* Station header */}
        <div className="popup-header">
          <h3 className="popup-station-name">{station.zh}</h3>
          <span className="popup-station-name-en">{station.en}</span>
          <div className="popup-line-tags">
            {lines.map(line => (
              <span
                key={line}
                className="popup-line-tag"
                style={{ backgroundColor: lineColors[line] || '#666' }}
              >
                {lineNames[line]?.zh || line}
              </span>
            ))}
          </div>
        </div>

        {/* Train information */}
        <div className="popup-trains">
          {loading && trainData.length === 0 && (
            <div className="popup-loading">
              <div className="popup-loading-spinner" />
              <span>正在載入列車資訊...</span>
            </div>
          )}

          {error && (
            <div className="popup-error">{error}</div>
          )}

          {trainData.map((dir, idx) => (
            <div key={idx} className="popup-direction">
              <div className="popup-direction-label">{dir.label}</div>
              {dir.trains.length === 0 ? (
                <div className="popup-no-train">暫無班次</div>
              ) : (
                <div className="popup-train-list">
                  {dir.trains.map((train, tidx) => (
                    <div key={tidx} className="popup-train-item">
                      <span className="popup-train-dest">
                        → {getDestName(train.dest)}
                      </span>
                      <span className="popup-train-plat">
                        {train.plat}號月台
                      </span>
                      <span className={`popup-train-time ${
                        train.ttnt === '0' || train.ttnt === '-' ? 'arriving' : ''
                      }`}>
                        {train.ttnt === '0' || train.ttnt === '-'
                          ? '即將到站'
                          : `${train.ttnt} 分鐘`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {!loading && trainData.length === 0 && !error && (
            <div className="popup-no-train">目前沒有列車服務</div>
          )}
        </div>

        {/* Footer */}
        {lastUpdated && (
          <div className="popup-footer">
            <span className="popup-update-time">更新時間: {lastUpdated}</span>
            <button className="popup-refresh-btn" onClick={loadTrainData} disabled={loading}>
              {loading ? '⟳' : '↻ 刷新'}
            </button>
          </div>
        )}
      </div>
    </Popup>
  );
}
