import { useState, useRef, useEffect } from 'react'
import { StationMap, TicketType } from '../types'
import { Search, CreditCard, Ticket, ChevronDown, ArrowRightLeft } from 'lucide-react'
import linesData from '../lines.json'

interface LineData {
  name: { zh: string; en: string }
  stations: string[]
}

interface LinesMap {
  [lineCode: string]: LineData
}

const lines = linesData as LinesMap

interface SearchableDropdownProps {
  label: string
  options: { id: string; zh: string; en: string }[]
  value: string | null
  onChange: (id: string) => void
  placeholder: string
  accentColor: string
}

const accentStyles = {
  green: {
    border: 'border-green-500',
    ring: 'ring-green-500/20',
    bg: 'bg-green-50',
    text: 'text-green-700'
  },
  red: {
    border: 'border-red-500',
    ring: 'ring-red-500/20',
    bg: 'bg-red-50',
    text: 'text-red-700'
  }
}

const SearchableDropdown = ({ label, options, value, onChange, placeholder, accentColor }: SearchableDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  
  const styles = accentStyles[accentColor as keyof typeof accentStyles]

  const selectedStation = options.find(o => o.id === value)
  const filteredOptions = options.filter(o => 
    o.zh.includes(search) || o.en.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <label className="text-[10px] uppercase tracking-widest text-gray-400 font-black ml-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 bg-gray-50 border-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
          isOpen ? `${styles.border} ring-2 ${styles.ring}` : 'border-gray-100 hover:border-gray-200'
        }`}
      >
        <span className={`text-sm font-medium ${!selectedStation ? 'text-gray-400' : 'text-gray-900'}`}>
          {selectedStation ? `${selectedStation.zh} ${selectedStation.en}` : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-gray-900 overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                autoFocus
                type="text"
                className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:bg-white transition-colors"
                placeholder="Search station..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(s => (
                <div 
                  key={s.id}
                  onClick={() => {
                    onChange(s.id)
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    value === s.id ? `${styles.bg} ${styles.text} font-bold` : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm">{s.zh}</div>
                  <div className="text-[10px] opacity-60 uppercase tracking-wider">{s.en}</div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-gray-400">No stations found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface ControlPanelProps {
  stations: StationMap
  originId: string | null
  destinationId: string | null
  ticketType: TicketType
  onOriginChange: (id: string) => void
  onDestinationChange: (id: string) => void
  onTicketTypeChange: (type: TicketType) => void
}

const ControlPanel = ({
  stations,
  originId,
  destinationId,
  ticketType,
  onOriginChange,
  onDestinationChange,
  onTicketTypeChange,
}: ControlPanelProps) => {
  const [originLine, setOriginLine] = useState<string>('ALL')
  const [destLine, setDestLine] = useState<string>('ALL')

  const getFilteredStations = (lineCode: string) => {
    const stationIds = lineCode === 'ALL' 
      ? Object.keys(stations) 
      : lines[lineCode]?.stations || []
    
    let result = stationIds.map(id => ({ id, ...stations[id] }))
    if (lineCode === 'ALL') {
      result.sort((a, b) => a.en.localeCompare(b.en))
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
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
      {/* Ticket Type Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-xl flex gap-1 w-full max-w-sm">
          <button
            onClick={() => onTicketTypeChange('octopus')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${
              ticketType === 'octopus' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Adult Octopus
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
            Adult Single
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 relative">
        {/* Origin Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold mb-1">
            <div className="w-2 h-6 bg-green-500 rounded-full" />
            <h3>Starting Point</h3>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-black ml-1">Select Line</label>
              <select 
                className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none text-sm font-medium"
                value={originLine}
                onChange={(e) => {
                  setOriginLine(e.target.value)
                  onOriginChange('')
                }}
              >
                <option value="ALL">All MTR Lines</option>
                {Object.entries(lines).map(([code, data]) => (
                  <option key={code} value={code}>{data.name.zh} {data.name.en}</option>
                ))}
              </select>
            </div>

            <SearchableDropdown 
              label="Select Station"
              options={originStations}
              value={originId}
              onChange={onOriginChange}
              placeholder="Choose Station"
              accentColor="green"
            />
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center items-center md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10 my-4 md:my-0">
          <button 
            onClick={handleSwap}
            className="bg-white border-2 border-gray-100 p-2.5 rounded-full shadow-lg hover:shadow-xl hover:border-gray-200 transition-all hover:rotate-180 duration-300"
            title="Swap Origin and Destination"
          >
            <ArrowRightLeft className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Destination Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold mb-1">
            <div className="w-2 h-6 bg-red-500 rounded-full" />
            <h3>Final Destination</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-black ml-1">Select Line</label>
              <select 
                className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none text-sm font-medium"
                value={destLine}
                onChange={(e) => {
                  setDestLine(e.target.value)
                  onDestinationChange('')
                }}
              >
                <option value="ALL">All MTR Lines</option>
                {Object.entries(lines).map(([code, data]) => (
                  <option key={code} value={code}>{data.name.zh} {data.name.en}</option>
                ))}
              </select>
            </div>

            <SearchableDropdown 
              label="Select Station"
              options={destStations}
              value={destinationId}
              onChange={onDestinationChange}
              placeholder="Choose Station"
              accentColor="red"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ControlPanel
