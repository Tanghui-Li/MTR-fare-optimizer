import { useState, useRef, useEffect, useId } from 'react'
import { TicketType } from '../types'
import { Search, CreditCard, Ticket, ChevronDown, ArrowRightLeft } from 'lucide-react'
import { getLineFilterOptions, getSelectableStations, getLocalizedLineDefinitionLabel } from '../data/unifiedNetwork'
import { Locale } from '../types'
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
  const triggerId = useId()
  const listboxId = useId()
  
  const styles = accentStyles[accentColor as keyof typeof accentStyles]

  const selectedStation = options.find(o => o.id === value)
  const filteredOptions = options.filter(o => 
    getLocalizedText(o, locale).includes(search) ||
    o.zh.includes(search) ||
    o.en.toLowerCase().includes(search.toLowerCase())
  )
  const stationText = (station?: { zh: string; zhHans?: string; en: string }) => {
    if (!station) return ''
    return getLocalizedText(station, locale)
  }
  const noStationText = locale === 'en' ? 'No stations found' : locale === 'zh-Hans' ? '没有找到车站' : '找不到車站'
  const activeOptionId = filteredOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined

  const selectStation = (id: string) => {
    onChange(id)
    setIsOpen(false)
    setSearch('')
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [search, isOpen])

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <label htmlFor={triggerId} className="text-[10px] uppercase tracking-widest text-gray-400 font-black ml-1">{label}</label>
      <button
        id={triggerId}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsOpen(true)
          }
          if (event.key === 'Escape') {
            setIsOpen(false)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`w-full p-3 bg-gray-50 border-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
          isOpen ? `${styles.border} ring-2 ${styles.ring}` : 'border-gray-100 hover:border-gray-200'
        }`}
      >
        <span className={`text-sm font-medium ${!selectedStation ? 'text-gray-400' : 'text-gray-900'}`}>
          {selectedStation ? stationText(selectedStation) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="station-dropdown-menu absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-gray-900 overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                autoFocus
                type="text"
                aria-label={locale === 'en' ? 'Search station' : locale === 'zh-Hans' ? '搜索车站' : '搜尋車站'}
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:bg-white transition-colors"
                placeholder={locale === 'en' ? 'Search station...' : locale === 'zh-Hans' ? '搜索车站...' : '搜尋車站...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActiveIndex((index) => filteredOptions.length > 0 ? Math.min(index + 1, filteredOptions.length - 1) : 0)
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActiveIndex((index) => filteredOptions.length > 0 ? Math.max(index - 1, 0) : 0)
                  }
                  if (event.key === 'Enter' && filteredOptions[activeIndex]) {
                    event.preventDefault()
                    selectStation(filteredOptions[activeIndex].id)
                  }
                  if (event.key === 'Escape') {
                    setIsOpen(false)
                  }
                }}
              />
            </div>
          </div>
          <div id={listboxId} role="listbox" aria-labelledby={triggerId} className="station-dropdown-list max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((s, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === s.id}
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
              <div className="p-4 text-center text-sm text-gray-400">{noStationText}</div>
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
  onOriginChange: (id: string) => void
  onDestinationChange: (id: string) => void
  onTicketTypeChange: (type: TicketType) => void
  locale: Locale
}

const ControlPanel = ({
  originId,
  destinationId,
  ticketType,
  onOriginChange,
  onDestinationChange,
  onTicketTypeChange,
  locale,
}: ControlPanelProps) => {
  const [originLine, setOriginLine] = useState<string>('ALL')
  const [destLine, setDestLine] = useState<string>('ALL')

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
      {/* Ticket Type Toggle */}
      <div className="flex justify-center">
        <div className="ticket-type-toggle bg-gray-100 p-1 rounded-xl flex gap-1 w-full max-w-sm">
          <button
            onClick={() => onTicketTypeChange('octopus')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${
              ticketType === 'octopus' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {t(locale, 'ticketOctopus')}
          </button>
          <button
            onClick={() => onTicketTypeChange('single')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${
              ticketType === 'single' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Ticket className="w-4 h-4" />
            {t(locale, 'ticketSingle')}
          </button>
        </div>
      </div>

      <div className="route-form-grid grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 relative">
        {/* Origin Section */}
        <div className="route-form-section space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
            <div className="w-2 h-6 bg-slate-900 rounded-full" />
            <h3>{t(locale, 'startingPoint')}</h3>
          </div>
          
          <div className="route-form-fields space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-black ml-1">{t(locale, 'selectLine')}</label>
              <select 
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
                label={t(locale, 'selectStation')}
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
            onClick={handleSwap}
            className="bg-white border-2 border-gray-100 p-2.5 rounded-full shadow-lg hover:shadow-xl hover:border-gray-200 transition-all hover:rotate-180 duration-300"
            title={t(locale, 'swapStations')}
          >
            <ArrowRightLeft className="w-4 h-4 text-gray-400" />
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
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-black ml-1">{t(locale, 'selectLine')}</label>
              <select 
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
              label={t(locale, 'selectStation')}
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
    </div>
  )
}

export default ControlPanel
