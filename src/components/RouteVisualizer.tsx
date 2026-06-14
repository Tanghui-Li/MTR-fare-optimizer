import { useId } from 'react'
import { RouteInsight, RouteResult, StationMap, TicketType, DetailedSegment, Locale } from '../types'
import FragmentedRouteCard from './FragmentedRouteCard'
import DirectRouteCard from './DirectRouteCard'
import { Accessibility, Clock, Gauge, LogOut, TrendingDown } from 'lucide-react'
import { formatCurrency, t } from '../i18n'
import { getReasonText, getTradeoffText, estimateRouteMinutes } from '../utils/routeInsights'

type RouteMode = 'optimized' | 'boring';

interface RouteVisualizerProps {
  routeResult: RouteResult
  stations: StationMap
  directFare: number
  ticketType: TicketType
  routeMode: RouteMode
  onRouteModeChange: (mode: RouteMode) => void
  optimizedSegments: DetailedSegment[]
  boringSegments: DetailedSegment[]
  routeInsight: RouteInsight | null
  locale: Locale
}

const RouteVisualizer = ({
  routeResult,
  stations,
  directFare,
  ticketType,
  routeMode,
  onRouteModeChange,
  optimizedSegments,
  boringSegments,
  routeInsight,
  locale,
}: RouteVisualizerProps) => {
  const recommendedFare = routeInsight?.metrics.fare ?? routeResult.totalFare
  const lowestFare = routeInsight?.alternatives.lowestFare?.fare ?? Math.min(recommendedFare, directFare)
  const regularFare = routeInsight?.alternatives.regular?.fare ?? directFare
  const savings = regularFare - recommendedFare
  const hasSavings = savings > 0.01 // Floating point safety
  const gateChanges = Math.max(optimizedSegments.length - 1, 0)
  const regularMinutes = routeInsight?.alternatives.regular?.estimatedMinutes ?? estimateRouteMinutes(boringSegments)
  const recommendedMinutes = routeInsight?.metrics.estimatedMinutes ?? estimateRouteMinutes(optimizedSegments)
  const accessibilityPercent = routeInsight
    ? Math.round(routeInsight.metrics.accessibilityScore * 100)
    : 100
  const routeModeName = useId()
  const insightCopy = {
    en: {
      title: 'Smart recommendation',
      recommended: 'Recommended',
      regular: 'Regular',
      minutes: 'min',
      estimatedTime: 'Estimated time',
      accessibility: 'Accessibility match',
    },
    'zh-Hans': {
      title: '智能推荐',
      recommended: '推荐路线',
      regular: '常规路线',
      minutes: '分钟',
      estimatedTime: '预计耗时',
      accessibility: '无障碍匹配',
    },
    'zh-Hant': {
      title: '智能推薦',
      recommended: '推薦路線',
      regular: '常規路線',
      minutes: '分鐘',
      estimatedTime: '預計耗時',
      accessibility: '無障礙匹配',
    },
  }[locale]

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {routeInsight && (
        <section className="route-insight-panel" aria-label={insightCopy.title}>
          <div className="route-insight-header">
            <Gauge className="w-4 h-4" aria-hidden="true" />
            <h3>{insightCopy.title}</h3>
          </div>
          <p className="route-insight-reason">{getReasonText(locale, routeInsight.selectedReason)}</p>
          <div className="route-insight-metrics">
            <div>
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>{insightCopy.estimatedTime}</span>
              <strong>{recommendedMinutes} {insightCopy.minutes}</strong>
            </div>
            <div>
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>{t(locale, 'routeComparisonGateChanges')}</span>
              <strong>{routeInsight.metrics.gateChanges}</strong>
            </div>
            <div>
              <Accessibility className="w-4 h-4" aria-hidden="true" />
              <span>{insightCopy.accessibility}</span>
              <strong>{accessibilityPercent}%</strong>
            </div>
          </div>
          {routeInsight.tradeoffNotes.length > 0 && (
            <ul className="route-insight-notes">
              {routeInsight.tradeoffNotes.map((note) => (
                <li key={note}>{getTradeoffText(locale, note)}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!hasSavings ? (
        <div className="no-savings-banner">
          <div className="no-savings-icon">✅</div>
          <div>
            <h3 className="no-savings-title">{t(locale, 'noSavingsTitle')}</h3>
            <p className="no-savings-sub">
              {t(locale, 'noSavingsSub')} {formatCurrency(routeResult.totalFare)}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Savings Banner */}
          {routeMode === 'optimized' && (
            <div className="savings-banner">
              <div className="savings-banner-left">
                <div className="savings-icon">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="savings-amount">
                    {t(locale, 'youSaved')}: {formatCurrency(savings)}
                  </p>
                  <p className="savings-sub">{t(locale, 'extremeEfficiency')}</p>
                </div>
              </div>
              <div className="savings-watermark">{t(locale, 'routeComparisonSavings')}</div>
            </div>
          )}

          {/* Route Mode Toggle */}
          <fieldset className="route-mode-toggle">
            <legend className="sr-only">{t(locale, 'routeDisplayMode')}</legend>
            <label
              className={`route-mode-btn ${routeMode === 'optimized' ? 'route-mode-btn-active optimized' : ''}`}
            >
              <input
                type="radio"
                name={routeModeName}
                value="optimized"
                checked={routeMode === 'optimized'}
                onChange={() => onRouteModeChange('optimized')}
                className="segmented-radio-input"
              />
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              {t(locale, 'routeModeOptimized')}
              <span className="route-mode-fare">{formatCurrency(routeResult.totalFare)}</span>
            </label>
            <label
              className={`route-mode-btn ${routeMode === 'boring' ? 'route-mode-btn-active boring' : ''}`}
            >
              <input
                type="radio"
                name={routeModeName}
                value="boring"
                checked={routeMode === 'boring'}
                onChange={() => onRouteModeChange('boring')}
                className="segmented-radio-input"
              />
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              {t(locale, 'routeModeBoring')}
              <span className="route-mode-fare">{formatCurrency(directFare)}</span>
            </label>
          </fieldset>
        </>
      )}

      <section className="route-comparison-panel" aria-label={t(locale, 'routeComparisonTitle')} aria-live="polite">
        <div className="route-comparison-header">
          <h3>{t(locale, 'routeComparisonTitle')}</h3>
          <p>{hasSavings ? t(locale, 'routeComparisonHint') : t(locale, 'routeComparisonNoExtraSavings')}</p>
        </div>
        <dl className="route-comparison-grid">
          <div>
            <dt>{t(locale, 'routeComparisonLowest')}</dt>
            <dd>{formatCurrency(lowestFare)}</dd>
          </div>
          <div className="route-comparison-recommended">
            <dt>{t(locale, 'routeComparisonRecommended')}</dt>
            <dd>{formatCurrency(recommendedFare)}</dd>
          </div>
          <div>
            <dt>{t(locale, 'routeComparisonRegular')}</dt>
            <dd>{formatCurrency(regularFare)}</dd>
          </div>
          <div>
            <dt>{t(locale, 'routeComparisonSavings')}</dt>
            <dd>{formatCurrency(Math.max(savings, 0))}</dd>
          </div>
          <div>
            <dt>{t(locale, 'routeComparisonGateChanges')}</dt>
            <dd>{gateChanges}</dd>
          </div>
          <div>
            <dt>{insightCopy.recommended} {insightCopy.estimatedTime}</dt>
            <dd>{recommendedMinutes} {insightCopy.minutes}</dd>
          </div>
          <div>
            <dt>{insightCopy.regular} {insightCopy.estimatedTime}</dt>
            <dd>{regularMinutes} {insightCopy.minutes}</dd>
          </div>
        </dl>
      </section>

      {/* Route Card */}
      {(!hasSavings || routeMode === 'optimized') ? (
        <FragmentedRouteCard 
          routeResult={routeResult} 
          stations={stations} 
          ticketType={ticketType}
          detailedSegments={optimizedSegments}
          customLabel={!hasSavings ? t(locale, 'standardBestRoute') : undefined}
          locale={locale}
        />
      ) : (
        <DirectRouteCard 
          fare={directFare} 
          stations={stations}
          detailedSegments={boringSegments}
          locale={locale}
        />
      )}
    </div>
  )
}

export default RouteVisualizer
