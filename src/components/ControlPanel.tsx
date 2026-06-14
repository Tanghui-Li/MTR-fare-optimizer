import { useState, useRef, useEffect, useId } from 'react'
import { AccessibilityRouteMode, Locale, RouteOptimizationGoal, TicketType } from '../types'
import { Accessibility, Clock, CreditCard, Gauge, LogOut, Search, Ticket, ChevronDown, ArrowRightLeft, X } from 'lucide-react'
import { getLineFilterOptions, getSelectableStations, getLocalizedLineDefinitionLabel } from '../data/unifiedNetwork'
import { t } from '../i18n'
import { getLocalizedText } from '../data/zhHansText'

interface SearchableDropdownProps {
  label: string
  options: { id: string; zh: string; zhHans?: string; en: string }[]
  value: string | null
  onChange: (id: string) => void
  placeholder: string
  accentColor: string
  locale: Locale
}

const MAX_VISIBLE_STATIONS = 80

const accentStyles = {
  slate: {
    border: 'border-slate-900',
    ring: 'ring-slate-900/20',
    bg: 'bg-slate-50',
    text: 'text-slate-900'
  }
}

const SearchableDropdown = ({ label, options, value, onChange, placeholder, accentColor, locale }: SearchableDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const labelId = useId()
  const listboxId = useId()
  const statusId = useId()
  
  const styles = accentStyles[accentColor as keyof typeof accentStyles]

  const selectedStation = options.find(o => o.id === value)
  const filteredOptions = options.filter(o => 
    getLocalizedText(o, locale).includes(search) ||
    o.zh.includes(search) ||
    o.en.toLowerCase().includes(search.toLowerCase())
  )
  const visibleOptions = filteredOptions.slice(0, MAX_VISIBLE_STATIONS)
  const stationText = (station?: { zh: string; zhHans?: string; en: string }) => {
    if (!station) return ''
    return getLocalizedText(station, locale)
  }
  const noStationText = locale === 'en' ? 'No stations found' : locale === 'zh-Hans' ? '没有找到车站' : '找不到車站'
  const closeText = locale === 'en' ? 'Close station selector' : locale === 'zh-Hans' ? '关闭车站选择器' : '關閉車站選擇器'
  const hiddenOptionCount = Math.max(filteredOptions.length - visibleOptions.length, 0)
  const resultStatusText = hiddenOptionCount > 0
    ? locale === 'en'
      ? `Showing ${visibleOptions.length} of ${filteredOptions.length} stations. Type more to narrow the list.`
      : locale === 'zh-Hans'
        ? `正在显示 ${filteredOptions.length} 个车站中的前 ${visibleOptions.length} 个。继续输入可缩小列表。`
        : `正在顯示 ${filteredOptions.length} 個車站中的前 ${visibleOptions.length} 個。繼續輸入可縮小列表。`
    : locale === 'en'
      ? `${filteredOptions.length} stations available`
      : locale === 'zh-Hans'
        ? `可选 ${filteredOptions.length} 个车站`
        : `可選 ${filteredOptions.length} 個車站`
  const activeOptionId = visibleOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined

  const closeDropdown = (restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }

  const selectStation = (id: string) => {
    onChange(id)
    closeDropdown(true)
    setSearch('')
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [search, isOpen])

  return (
    <div
      className="space-y-1 relative"
      ref={containerRef}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null
        if (isOpen && !event.currentTarget.contains(nextTarget)) {
          closeDropdown()
        }
      }}
    >
      <label id={labelId} htmlFor={triggerId} className="text-[10px] uppercase tracking-widest text-gray-600 font-black ml-1">{label}</label>
      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsOpen(true)
          }
          if (event.key === 'Escape') {
            closeDropdown(true)
          }
        }}
        aria-label={`${label}: ${selectedStation ? stationText(selectedStation) : placeholder}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`w-full p-3 bg-gray-50 border-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
          isOpen ? `${styles.border} ring-2 ${styles.ring}` : 'border-gray-100 hover:border-gray-200'
        }`}
      >
        <span className={`text-sm font-medium ${!selectedStation ? 'text-gray-600' : 'text-gray-900'}`}>
          {selectedStation ? stationText(selectedStation) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="station-dropdown-menu absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-gray-900 overflow-hidden animate-in fade-in zoom-in duration-200"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              closeDropdown(true)
            }
          }}
        >
          <div className="station-dropdown-header p-2 border-b border-gray-100">
            <div className="station-dropdown-search relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input 
                autoFocus
                type="text"
                role="combobox"
                aria-labelledby={labelId}
                aria-label={locale === 'en' ? `Search ${label}` : locale === 'zh-Hans' ? `搜索${label}` : `搜尋${label}`}
                aria-expanded={isOpen}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                aria-describedby={statusId}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:bg-white transition-colors"
                placeholder={locale === 'en' ? 'Search station...' : locale === 'zh-Hans' ? '搜索车站...' : '搜尋車站...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActiveIndex((index) => visibleOptions.length > 0 ? Math.min(index + 1, visibleOptions.length - 1) : 0)
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActiveIndex((index) => visibleOptions.length > 0 ? Math.max(index - 1, 0) : 0)
                  }
                  if (event.key === 'Enter' && visibleOptions[activeIndex]) {
                    event.preventDefault()
                    selectStation(visibleOptions[activeIndex].id)
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    closeDropdown(true)
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="station-dropdown-close"
              onClick={() => closeDropdown(true)}
              aria-label={closeText}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div id={statusId} className="station-search-status" aria-live="polite">
            {resultStatusText}
          </div>
          <div id={listboxId} role="listbox" aria-labelledby={labelId} className="station-dropdown-list max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((s, index) => (
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={value === s.id}
                  aria-posinset={index + 1}
                  aria-setsize={filteredOptions.length}
                  id={`${listboxId}-option-${index}`}
                  key={s.id}
                  onClick={() => selectStation(s.id)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    value === s.id || activeIndex === index ? `${styles.bg} ${styles.text} font-bold` : 'hover:bg-gray-50'
                  } w-full text-left`}
                >
                  <div className="text-sm">{getLocalizedText(s, locale)}</div>
                </button>
              ))
            ) : (
              <div role="option" aria-disabled="true" className="p-4 text-center text-sm text-gray-600">{noStationText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface ControlPanelProps {
  originId: string | null
  destinationId: string | null
  ticketType: TicketType
  goal: RouteOptimizationGoal
  accessibilityMode: AccessibilityRouteMode
  maxGateChanges: number | null
  minSavings: number
  onOriginChange: (id: string) => void
  onDestinationChange: (id: string) => void
  onTicketTypeChange: (type: TicketType) => void
  onGoalChange: (goal: RouteOptimizationGoal) => void
  onAccessibilityModeChange: (mode: AccessibilityRouteMode) => void
  onMaxGateChangesChange: (value: number | null) => void
  onMinSavingsChange: (value: number) => void
  onClearRoute: () => void
  onPlanRoute: () => void
  canPlanRoute: boolean
  hasAppliedRoute: boolean
  hasUnappliedChanges: boolean
  locale: Locale
}

const ControlPanel = ({
  originId,
  destinationId,
  ticketType,
  goal,
  accessibilityMode,
  maxGateChanges,
  minSavings,
  onOriginChange,
  onDestinationChange,
  onTicketTypeChange,
  onGoalChange,
  onAccessibilityModeChange,
  onMaxGateChangesChange,
  onMinSavingsChange,
  onClearRoute,
  onPlanRoute,
  canPlanRoute,
  hasAppliedRoute,
  hasUnappliedChanges,
  locale,
}: ControlPanelProps) => {
  const [originLine, setOriginLine] = useState<string>('ALL')
  const [destLine, setDestLine] = useState<string>('ALL')
  const originLineId = useId()
  const destLineId = useId()
  const ticketTypeName = useId()
  const goalName = useId()

  const lineOptions = [{ code: 'ALL', zh: '所有路線', zhHans: '所有线路', en: 'All Routes', category: 'MTR' as const }, ...getLineFilterOptions()]
  const getFilteredStations = (lineCode: string) => {
    const result = getSelectableStations(lineCode).map((option) => ({
      id: option.id,
      zh: option.zh,
      zhHans: option.zhHans,
      en: option.en,
    }))

    if (lineCode === 'ALL') {
      result.sort((a, b) => getLocalizedText(a, locale).localeCompare(getLocalizedText(b, locale), locale === 'en' ? 'en' : 'zh-HK'))
    }
    return result
  }

  const originStations = getFilteredStations(originLine)
  const destStations = getFilteredStations(destLine)
  const hasRouteDraft = Boolean(originId || destinationId || originLine !== 'ALL' || destLine !== 'ALL')
  const shouldShowPlanAction = !hasAppliedRoute || hasUnappliedChanges
  const preferenceCopy = {
    en: {
      title: 'Smart Route Preferences',
      fare: 'Lowest fare',
      balanced: 'Balanced',
      time: 'Faster',
      accessibility: 'Accessibility',
      accessibilityOff: 'Off',
      accessibilityPrefer: 'Prefer',
      accessibilityRequire: 'Require',
      maxGate: 'Max gate changes',
      anyGate: 'Any',
      minSavings: 'Minimum savings',
    },
    'zh-Hans': {
      title: '智能路线偏好',
      fare: '最低票价',
      balanced: '均衡',
      time: '更快',
      accessibility: '无障碍',
      accessibilityOff: '关闭',
      accessibilityPrefer: '优先',
      accessibilityRequire: '必须',
      maxGate: '最多出闸',
      anyGate: '不限',
      minSavings: '最少节省',
    },
    'zh-Hant': {
      title: '智能路線偏好',
      fare: '最低票價',
      balanced: '均衡',
      time: '更快',
      accessibility: '無障礙',
      accessibilityOff: '關閉',
      accessibilityPrefer: '優先',
      accessibilityRequire: '必須',
      maxGate: '最多出閘',
      anyGate: '不限',
      minSavings: '最少節省',
    },
  }[locale]

  const handleClearRoute = () => {
    setOriginLine('ALL')
    setDestLine('ALL')
    onClearRoute()
  }

  const handleSwap = () => {
    const tempLine = originLine
    setOriginLine(destLine)
    setDestLine(tempLine)

    const tempId = originId
    if (destinationId) onOriginChange(destinationId)
    else onOriginChange('')
    
    if (tempId) onDestinationChange(tempId)
    else onDestinationChange('')
  }

  return (
    <div className="control-panel-card bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
      <div className="control-panel-header">
        <h2 className="control-panel-title">{t(locale, 'routePanel')}</h2>
        {hasRouteDraft && (
          <button
            type="button"
            className="clear-route-button"
            onClick={handleClearRoute}
            aria-label={t(locale, 'clearRoute')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
            {t(locale, 'clearRoute')}
          </button>
        )}
      </div>

      {/* Ticket Type Toggle */}
      <div className="flex justify-center">
        <fieldset className="ticket-type-toggle bg-gray-100 p-1 rounded-xl flex gap-1 w-full max-w-sm">
          <legend className="sr-only">{t(locale, 'ticketType')}</legend>
          <label
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${
              ticketType === 'octopus' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <input
              type="radio"
              name={ticketTypeName}
              value="octopus"
              checked={ticketType === 'octopus'}
              onChange={() => onTicketTypeChange('octopus')}
              className="segmented-radio-input"
            />
            <CreditCard className="w-4 h-4" />
            {t(locale, 'ticketOctopus')}
          </label>
          <label
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${
              ticketType === 'single' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <input
              type="radio"
              name={ticketTypeName}
              value="single"
              checked={ticketType === 'single'}
              onChange={() => onTicketTypeChange('single')}
              className="segmented-radio-input"
            />
            <Ticket className="w-4 h-4" />
            {t(locale, 'ticketSingle')}
          </label>
        </fieldset>
      </div>

      <section className="route-preferences-panel" aria-label={preferenceCopy.title}>
        <div className="route-preferences-header">
          <Gauge className="w-4 h-4" aria-hidden="true" />
          <h3>{preferenceCopy.title}</h3>
        </div>

        <fieldset className="route-strategy-toggle">
          <legend className="sr-only">{preferenceCopy.title}</legend>
          <label className={`route-strategy-option ${goal === 'fare' ? 'active' : ''}`}>
            <input
              type="radio"
              name={goalName}
              value="fare"
              checked={goal === 'fare'}
              onChange={() => onGoalChange('fare')}
              className="segmented-radio-input"
            />
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            <span>{preferenceCopy.fare}</span>
          </label>
          <label className={`route-strategy-option ${goal === 'balanced' ? 'active' : ''}`}>
            <input
              type="radio"
              name={goalName}
              value="balanced"
              checked={goal === 'balanced'}
              onChange={() => onGoalChange('balanced')}
              className="segmented-radio-input"
            />
            <Gauge className="w-4 h-4" aria-hidden="true" />
            <span>{preferenceCopy.balanced}</span>
          </label>
          <label className={`route-strategy-option ${goal === 'time' ? 'active' : ''}`}>
            <input
              type="radio"
              name={goalName}
              value="time"
              checked={goal === 'time'}
              onChange={() => onGoalChange('time')}
              className="segmented-radio-input"
            />
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>{preferenceCopy.time}</span>
          </label>
        </fieldset>

        <div className="route-constraint-grid">
          <label className="route-preference-field">
            <span>
              <Accessibility className="w-3.5 h-3.5" aria-hidden="true" />
              {preferenceCopy.accessibility}
            </span>
            <select
              value={accessibilityMode}
              onChange={(event) => onAccessibilityModeChange(event.target.value as AccessibilityRouteMode)}
            >
              <option value="off">{preferenceCopy.accessibilityOff}</option>
              <option value="prefer">{preferenceCopy.accessibilityPrefer}</option>
              <option value="require">{preferenceCopy.accessibilityRequire}</option>
            </select>
          </label>

          <label className="route-preference-field">
            <span>
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              {preferenceCopy.maxGate}
            </span>
            <select
              value={maxGateChanges === null ? 'any' : String(maxGateChanges)}
              onChange={(event) => onMaxGateChangesChange(event.target.value === 'any' ? null : Number(event.target.value))}
            >
              <option value="any">{preferenceCopy.anyGate}</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>

          <label className="route-preference-field route-preference-field-wide">
            <span>
              <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
              {preferenceCopy.minSavings}
            </span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={minSavings}
              onChange={(event) => onMinSavingsChange(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
        </div>
      </section>

      <div className="route-form-grid grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 relative">
        {/* Origin Section */}
        <div className="route-form-section space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
            <div className="w-2 h-6 bg-slate-900 rounded-full" />
            <h3>{t(locale, 'startingPoint')}</h3>
          </div>
          
          <div className="route-form-fields space-y-3">
            <div className="space-y-1">
              <label htmlFor={originLineId} className="text-[10px] uppercase tracking-widest text-gray-600 font-black ml-1">{t(locale, 'startingPoint')} {t(locale, 'selectLine')}</label>
              <select 
                id={originLineId}
                className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none text-sm font-medium"
                value={originLine}
                onChange={(e) => {
                  setOriginLine(e.target.value)
                  onOriginChange('')
                }}
              >
                {lineOptions.map((line) => (
                  <option key={line.code} value={line.code}>{getLocalizedLineDefinitionLabel(line, locale)}</option>
                ))}
              </select>
            </div>

              <SearchableDropdown 
                label={`${t(locale, 'startingPoint')} ${t(locale, 'selectStation')}`}
                options={originStations}
                value={originId}
                onChange={onOriginChange}
                placeholder={locale === 'en' ? 'Choose station' : locale === 'zh-Hans' ? '选择车站' : '選擇車站'}
                accentColor="slate"
                locale={locale}
              />
          </div>
        </div>

        {/* Swap Button */}
        <div className="swap-station-row flex justify-center items-center md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10 my-4 md:my-0">
          <button 
            type="button"
            onClick={handleSwap}
            className="bg-white border-2 border-gray-100 p-2.5 rounded-full shadow-lg hover:shadow-xl hover:border-gray-200 transition-all hover:rotate-180 duration-300"
            title={t(locale, 'swapStations')}
            aria-label={t(locale, 'swapStations')}
          >
            <ArrowRightLeft className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Destination Section */}
        <div className="route-form-section space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
            <div className="w-2 h-6 bg-slate-900 rounded-full" />
            <h3>{t(locale, 'finalDestination')}</h3>
          </div>

          <div className="route-form-fields space-y-3">
            <div className="space-y-1">
              <label htmlFor={destLineId} className="text-[10px] uppercase tracking-widest text-gray-600 font-black ml-1">{t(locale, 'finalDestination')} {t(locale, 'selectLine')}</label>
              <select 
                id={destLineId}
                className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none text-sm font-medium"
                value={destLine}
                onChange={(e) => {
                  setDestLine(e.target.value)
                  onDestinationChange('')
                }}
              >
                {lineOptions.map((line) => (
                  <option key={line.code} value={line.code}>{getLocalizedLineDefinitionLabel(line, locale)}</option>
                ))}
              </select>
            </div>

              <SearchableDropdown 
              label={`${t(locale, 'finalDestination')} ${t(locale, 'selectStation')}`}
                options={destStations}
                value={destinationId}
                onChange={onDestinationChange}
                placeholder={locale === 'en' ? 'Choose station' : locale === 'zh-Hans' ? '选择车站' : '選擇車站'}
                accentColor="slate"
              locale={locale}
              />
          </div>
        </div>
      </div>

      {shouldShowPlanAction && (
        <button
          type="button"
          className="plan-route-button"
          onClick={onPlanRoute}
          disabled={!canPlanRoute}
        >
          {hasAppliedRoute ? t(locale, 'updateRoute') : t(locale, 'planRoute')}
        </button>
      )}
    </div>
  )
}

export default ControlPanel
