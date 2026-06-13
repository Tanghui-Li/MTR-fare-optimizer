import { useState, useMemo, useId } from 'react';
import accessibilityRaw from '../data/accessibilityData.json';
import stationsData from '../data/stations.json';
import { Locale, StationMap } from '../types';
import { t } from '../i18n';
import { getLocalizedText } from '../data/zhHansText';

const accessibilityData = accessibilityRaw as {
  categories: Record<string, { catId: string; catZh: string; catEn: string; zh: string; en: string; order: number }>;
  facilities: Record<string, Record<string, true | { zh: string; en: string }>>;
};
const stations = stationsData as StationMap;

const categoryOrder = ['AJ', 'MJ', 'VJ', 'HJ'];
const categoryIcons: Record<string, string> = {
  AJ: '🚪',
  MJ: '♿',
  VJ: '👁️',
  HJ: '🦻',
};

interface AccessibilityFilterProps {
  filter: string[][];
  onFilterChange: (filter: string[][]) => void;
  locale: Locale;
}

export default function AccessibilityFilter({ filter, onFilterChange, locale }: AccessibilityFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const contentId = useId();
  const simplePanelId = useId();
  const advancedPanelId = useId();
  const modeName = useId();

  // Group items by category
  const grouped = useMemo(() => {
    const result: Record<string, { catZh: string; catEn: string; items: { code: string; zh: string; en: string }[] }> = {};
    for (const [code, info] of Object.entries(accessibilityData.categories)) {
      const catId = info.catId;
      if (!result[catId]) {
        result[catId] = { catZh: info.catZh, catEn: info.catEn, items: [] };
      }
      result[catId].items.push({ code, zh: info.zh, en: info.en });
    }
    // Sort items within each category
    for (const group of Object.values(result)) {
      group.items.sort((a, b) => {
        const oa = accessibilityData.categories[a.code]?.order ?? 99;
        const ob = accessibilityData.categories[b.code]?.order ?? 99;
        return oa - ob;
      });
    }
    return result;
  }, []);

  // Simple mode: each selected item becomes its own clause (AND of individual items)
  // Advanced mode: user builds explicit CNF clauses

  // Flat set of all selected codes (for simple mode)
  const selectedCodes = useMemo(() => {
    const set = new Set<string>();
    for (const clause of filter) {
      for (const code of clause) set.add(code);
    }
    return set;
  }, [filter]);

  const toggleSimple = (code: string) => {
    if (selectedCodes.has(code)) {
      const nextFilter = filter
        .map(clause => clause.filter(item => item !== code))
        .filter(clause => clause.length > 0);
      onFilterChange(nextFilter);
    } else {
      onFilterChange([...filter, [code]]);
    }
  };

  // Advanced mode: add a new clause
  const [pendingClause, setPendingClause] = useState<Set<string>>(new Set());
  
  const addClause = () => {
    if (pendingClause.size === 0) return;
    onFilterChange([...filter, Array.from(pendingClause)]);
    setPendingClause(new Set());
  };

  const removeClause = (idx: number) => {
    onFilterChange(filter.filter((_, i) => i !== idx));
  };

  const togglePending = (code: string) => {
    const next = new Set(pendingClause);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setPendingClause(next);
  };

  const clearAll = () => {
    onFilterChange([]);
    setPendingClause(new Set());
  };

  const hasFilter = filter.length > 0;
  const localName = (value: { zh: string; en: string }) => getLocalizedText(value, locale);
  const matchedStationIds = useMemo(() => {
    if (!hasFilter) return [];
    return Object.entries(accessibilityData.facilities)
      .filter(([, facilities]) => filter.every((clause) => clause.some((code) => code in facilities)))
      .map(([stationId]) => stationId);
  }, [filter, hasFilter]);
  const matchedStations = useMemo(() => (
    matchedStationIds
      .map((stationId) => ({ stationId, station: stations[stationId] }))
      .filter((item): item is { stationId: string; station: StationMap[string] } => Boolean(item.station))
      .map(({ stationId, station }) => ({ stationId, name: getLocalizedText(station, locale) }))
  ), [matchedStationIds, locale]);
  const filterStatusText = !hasFilter
    ? t(locale, 'accessibilityFilterInactive')
    : matchedStationIds.length === 0
      ? t(locale, 'accessibilityFilterNoMatches')
      : locale === 'en'
        ? `${matchedStationIds.length} stations match the accessibility filter`
        : locale === 'zh-Hans'
          ? `${matchedStationIds.length} 个车站符合无障碍筛选`
          : `${matchedStationIds.length} 個車站符合無障礙篩選`;

  return (
    <div className={`acc-filter-panel ${expanded ? 'expanded' : ''}`}>
      <div className="sr-only" role="status" aria-live="polite">
        {filterStatusText}
      </div>
      <button
        type="button"
        className="acc-filter-toggle"
        aria-label={`${t(locale, 'accessibilityFilter')}: ${filterStatusText}`}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="acc-filter-toggle-icon">
          {hasFilter ? '♿✨' : '♿'}
        </span>
        <span className="acc-filter-toggle-text">
          {t(locale, 'accessibilityFilter')}
          {hasFilter && <span className="acc-filter-badge">{filter.length}</span>}
        </span>
        <span className="acc-filter-arrow">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div id={contentId} className="acc-filter-content">
          <div className="acc-filter-result" role="status" aria-live="polite">
            <strong>{filterStatusText}</strong>
            {hasFilter && matchedStations.length > 0 && (
              <div className="acc-filter-match-list" aria-label={t(locale, 'accessibilityFilterMatchList')}>
                <span>{t(locale, 'accessibilityFilterMatchList')}</span>
                <ul>
                  {matchedStations.map(({ stationId, name }) => (
                    <li key={stationId}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {/* Mode toggle */}
          <fieldset className="acc-filter-mode-row">
            <legend className="sr-only">{t(locale, 'accessibilityFilter')}</legend>
            <label
              className={`acc-filter-mode-btn ${!isAdvanced ? 'active' : ''}`}
            >
              <input
                type="radio"
                name={modeName}
                checked={!isAdvanced}
                aria-controls={simplePanelId}
                onChange={() => { setIsAdvanced(false); setPendingClause(new Set()); }}
                className="segmented-radio-input"
              />
              {t(locale, 'simpleFilter')}
            </label>
            <label
              className={`acc-filter-mode-btn ${isAdvanced ? 'active' : ''}`}
            >
              <input
                type="radio"
                name={modeName}
                checked={isAdvanced}
                aria-controls={advancedPanelId}
                onChange={() => setIsAdvanced(true)}
                className="segmented-radio-input"
              />
              {t(locale, 'advancedFilterReadable')}
            </label>
            {hasFilter && (
              <button type="button" className="acc-filter-clear-btn" onClick={clearAll}>
                {t(locale, 'clearAll')}
              </button>
            )}
          </fieldset>

          {!isAdvanced && (
            /* Simple mode: checkboxes, each = AND clause */
            <div id={simplePanelId} className="acc-filter-simple" role="region" aria-label={t(locale, 'simpleFilter')}>
              <div className="acc-filter-hint">{t(locale, 'accessibilitySimpleHint')}</div>
              {categoryOrder.map(catId => {
                const group = grouped[catId];
                if (!group) return null;
                return (
                  <div key={catId} className="acc-filter-cat">
                    <div className="acc-filter-cat-header">
                      <span>{categoryIcons[catId]}</span>
                      <span className="acc-filter-cat-name">
                        {locale === 'en' ? group.catEn : getLocalizedText({ zh: group.catZh, en: group.catEn }, locale)}
                      </span>
                    </div>
                    <div className="acc-filter-cat-items">
                      {group.items.map(item => (
                        <label key={item.code} className="acc-filter-item">
                          <input
                            type="checkbox"
                            checked={selectedCodes.has(item.code)}
                            onChange={() => toggleSimple(item.code)}
                          />
                          <span className="acc-filter-item-label">
                            {localName(item)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isAdvanced && (
            /* Advanced CNF mode */
            <div id={advancedPanelId} className="acc-filter-advanced" role="region" aria-label={t(locale, 'advancedFilterReadable')}>
              <div className="acc-filter-hint">
                {t(locale, 'accessibilityAdvancedHint')}
              </div>

              {/* Existing clauses */}
              {filter.map((clause, idx) => (
                <div key={idx} className="acc-filter-clause">
                  <div className="acc-filter-clause-header">
                    <span className="acc-filter-clause-num">{t(locale, 'filterGroup')} {idx + 1}</span>
                    <button
                      type="button"
                      className="acc-filter-clause-remove"
                      onClick={() => removeClause(idx)}
                      aria-label={`${t(locale, 'clearAll')} ${t(locale, 'filterGroup')} ${idx + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="acc-filter-clause-tags">
                    {clause.map(code => (
                      <span key={code} className="acc-filter-clause-tag">
                        {accessibilityData.categories[code]
                          ? localName(accessibilityData.categories[code])
                          : code}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add new clause builder */}
              <div className="acc-filter-clause-builder">
                <div className="acc-filter-clause-builder-title">
                  {filter.length > 0 ? `+ ${t(locale, 'addFilterGroup')}` : t(locale, 'buildFirstFilterGroup')}
                </div>
                <div className="acc-filter-clause-builder-items">
                  {categoryOrder.map(catId => {
                    const group = grouped[catId];
                    if (!group) return null;
                    return (
                      <div key={catId} className="acc-filter-cat">
                        <div className="acc-filter-cat-header">
                          <span>{categoryIcons[catId]}</span>
                          <span className="acc-filter-cat-name">
                            {locale === 'en' ? group.catEn : getLocalizedText({ zh: group.catZh, en: group.catEn }, locale)}
                          </span>
                        </div>
                        <div className="acc-filter-cat-items">
                          {group.items.map(item => (
                            <label key={item.code} className="acc-filter-item">
                              <input
                                type="checkbox"
                                checked={pendingClause.has(item.code)}
                                onChange={() => togglePending(item.code)}
                              />
                              <span className="acc-filter-item-label">
                                {localName(item)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="acc-filter-add-clause-btn"
                  onClick={addClause}
                  disabled={pendingClause.size === 0}
                >
                  {t(locale, 'addCurrentFilterGroup')} ({pendingClause.size} {t(locale, 'selectedItemsOr')})
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
