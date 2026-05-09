import { useState, useMemo } from 'react';
import accessibilityRaw from '../data/accessibilityData.json';

const accessibilityData = accessibilityRaw as {
  categories: Record<string, { catId: string; catZh: string; catEn: string; zh: string; en: string; order: number }>;
};

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
}

export default function AccessibilityFilter({ filter, onFilterChange }: AccessibilityFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);

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
      // Remove clause containing this code
      onFilterChange(filter.filter(clause => !(clause.length === 1 && clause[0] === code)));
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

  return (
    <div className={`acc-filter-panel ${expanded ? 'expanded' : ''}`}>
      <button
        className="acc-filter-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="acc-filter-toggle-icon">
          {hasFilter ? '♿✨' : '♿'}
        </span>
        <span className="acc-filter-toggle-text">
          無障礙篩選
          {hasFilter && <span className="acc-filter-badge">{filter.length}</span>}
        </span>
        <span className="acc-filter-arrow">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="acc-filter-content">
          {/* Mode toggle */}
          <div className="acc-filter-mode-row">
            <button
              className={`acc-filter-mode-btn ${!isAdvanced ? 'active' : ''}`}
              onClick={() => { setIsAdvanced(false); clearAll(); }}
            >
              簡單篩選
            </button>
            <button
              className={`acc-filter-mode-btn ${isAdvanced ? 'active' : ''}`}
              onClick={() => { setIsAdvanced(true); clearAll(); }}
            >
              高級篩選 (CNF)
            </button>
            {hasFilter && (
              <button className="acc-filter-clear-btn" onClick={clearAll}>
                清除全部
              </button>
            )}
          </div>

          {!isAdvanced && (
            /* Simple mode: checkboxes, each = AND clause */
            <div className="acc-filter-simple">
              <div className="acc-filter-hint">勾選需要的設施，車站將同時滿足所有條件</div>
              {categoryOrder.map(catId => {
                const group = grouped[catId];
                if (!group) return null;
                return (
                  <div key={catId} className="acc-filter-cat">
                    <div className="acc-filter-cat-header">
                      <span>{categoryIcons[catId]}</span>
                      <span className="acc-filter-cat-name">{group.catZh}</span>
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
                            {item.zh}
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
            <div className="acc-filter-advanced">
              <div className="acc-filter-hint">
                每個子句內的設施為「或」關係，子句之間為「且」關係（合取範式 CNF）
              </div>

              {/* Existing clauses */}
              {filter.map((clause, idx) => (
                <div key={idx} className="acc-filter-clause">
                  <div className="acc-filter-clause-header">
                    <span className="acc-filter-clause-num">子句 {idx + 1}</span>
                    <button className="acc-filter-clause-remove" onClick={() => removeClause(idx)}>✕</button>
                  </div>
                  <div className="acc-filter-clause-tags">
                    {clause.map(code => (
                      <span key={code} className="acc-filter-clause-tag">
                        {accessibilityData.categories[code]?.zh || code}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add new clause builder */}
              <div className="acc-filter-clause-builder">
                <div className="acc-filter-clause-builder-title">
                  {filter.length > 0 ? '＋ 添加新子句（AND）' : '構建第一個子句'}
                </div>
                <div className="acc-filter-clause-builder-items">
                  {categoryOrder.map(catId => {
                    const group = grouped[catId];
                    if (!group) return null;
                    return (
                      <div key={catId} className="acc-filter-cat">
                        <div className="acc-filter-cat-header">
                          <span>{categoryIcons[catId]}</span>
                          <span className="acc-filter-cat-name">{group.catZh}</span>
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
                                {item.zh}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="acc-filter-add-clause-btn"
                  onClick={addClause}
                  disabled={pendingClause.size === 0}
                >
                  添加此子句（{pendingClause.size} 項，以「或」連接）
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
