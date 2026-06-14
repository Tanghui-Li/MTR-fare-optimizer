import accessibilityRaw from '../data/accessibilityData.json';
import type {
  AccessibilityRouteMode,
  DetailedSegment,
  Locale,
  RouteInsight,
  RouteMetrics,
  RouteOptimizationGoal,
  RoutePlanningPreferences,
  RouteResult,
} from '../types';

const accessibilityData = accessibilityRaw as {
  facilities: Record<string, Record<string, true | { zh: string; en: string }>>;
};

const DEFAULT_WAIT_MINUTES: Record<string, number> = {
  MTR: 3,
  AEL: 6,
  LRT: 4,
  NWBUS: 7,
  TAIPOBUS: 7,
  TRANSFER: 4,
};

function uniqueRouteNodes(segments: DetailedSegment[]): string[] {
  const nodes: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    for (const step of segment.path) {
      if (seen.has(step.stationId)) continue;
      seen.add(step.stationId);
      nodes.push(step.stationId);
    }
  }

  return nodes;
}

function hasAccessibilityFacilities(stationId: string, filter: string[][]): boolean {
  if (filter.length === 0) return true;
  if (stationId.startsWith('bus:') || stationId.startsWith('lrt:')) return true;

  const facilities = accessibilityData.facilities[stationId];
  if (!facilities) return false;

  return filter.every((clause) => clause.some((code) => code in facilities));
}

export function getRouteGateChanges(segments?: DetailedSegment[]): number {
  return Math.max((segments?.length ?? 0) - 1, 0);
}

export function estimateRouteMinutes(segments?: DetailedSegment[]): number {
  if (!segments || segments.length === 0) return 0;

  return Math.max(1, Math.round(segments.reduce((total, segment) => {
    const mode = segment.mode || segment.path[0]?.mode || 'MTR';
    const perHop = mode === 'AEL'
      ? 4
      : mode === 'LRT'
        ? 2.4
        : mode === 'NWBUS' || mode === 'TAIPOBUS'
          ? 3
          : 2;
    const hops = Math.max(segment.path.length - 1, 1);
    const wait = DEFAULT_WAIT_MINUTES[mode] ?? DEFAULT_WAIT_MINUTES.MTR;
    return total + wait + hops * perHop;
  }, getRouteGateChanges(segments) * 4)));
}

export function evaluateRoute(
  result: RouteResult,
  preferences: Pick<RoutePlanningPreferences, 'accessibilityFilter' | 'accessibilityMode' | 'goal'>,
  goalOverride?: RouteOptimizationGoal,
): RouteMetrics {
  const segments = result.segments || [];
  const nodes = uniqueRouteNodes(segments);
  const gateChanges = getRouteGateChanges(segments);
  const estimatedMinutes = estimateRouteMinutes(segments);
  const transferCount = segments.reduce((count, segment) => {
    const lineCodes = new Set(segment.path.map((step) => step.lineCode).filter((line) => line !== 'TRANSFER'));
    return count + Math.max(lineCodes.size - 1, 0);
  }, gateChanges);

  const matchedStops = nodes.filter((nodeId) => hasAccessibilityFacilities(nodeId, preferences.accessibilityFilter)).length;
  const problemStops = Math.max(nodes.length - matchedStops, 0);
  const accessibilityScore = nodes.length === 0 ? 1 : matchedStops / nodes.length;
  const activeGoal = goalOverride || preferences.goal;
  const accessibilityPenalty = preferences.accessibilityMode === 'off'
    ? 0
    : problemStops * (preferences.accessibilityMode === 'require' ? 500 : 12);
  const gatePenalty = gateChanges * (activeGoal === 'fare' ? 0.2 : activeGoal === 'balanced' ? 2.5 : 4);
  const transferPenalty = transferCount * (activeGoal === 'time' ? 2.5 : 1.5);
  const score = activeGoal === 'fare'
    ? result.totalFare + accessibilityPenalty + gatePenalty + transferPenalty
    : activeGoal === 'time'
      ? estimatedMinutes + result.totalFare * 0.18 + accessibilityPenalty + gatePenalty + transferPenalty
      : estimatedMinutes * 0.65 + result.totalFare * 0.7 + accessibilityPenalty + gatePenalty + transferPenalty;

  return {
    fare: result.totalFare,
    estimatedMinutes,
    gateChanges,
    transferCount,
    stationCount: nodes.length,
    accessibilityMatchedStops: matchedStops,
    accessibilityProblemStops: problemStops,
    accessibilityScore,
    score,
  };
}

function isFiniteRoute(result: RouteResult): boolean {
  return Number.isFinite(result.totalFare);
}

function canUseRoute(
  metrics: RouteMetrics,
  preferences: RoutePlanningPreferences,
): boolean {
  if (preferences.maxGateChanges !== null && metrics.gateChanges > preferences.maxGateChanges) return false;
  if (preferences.accessibilityMode === 'require' && metrics.accessibilityProblemStops > 0) return false;
  return true;
}

function pickCandidate(
  candidates: Array<{ result: RouteResult; metrics: RouteMetrics }>,
): { result: RouteResult; metrics: RouteMetrics } {
  return candidates.reduce((best, candidate) => {
    if (candidate.metrics.score < best.metrics.score) return candidate;
    if (candidate.metrics.score === best.metrics.score && candidate.metrics.fare < best.metrics.fare) return candidate;
    return best;
  });
}

export function selectRecommendedRoute(
  candidates: {
    lowestFare: RouteResult;
    regular: RouteResult;
    fastest: RouteResult;
    balanced: RouteResult;
  },
  preferences: RoutePlanningPreferences,
): {
  result: RouteResult;
  insight: RouteInsight;
} {
  const lowestFareMetrics = evaluateRoute(candidates.lowestFare, preferences, 'fare');
  const regularMetrics = evaluateRoute(candidates.regular, preferences, 'time');
  const fastestMetrics = evaluateRoute(candidates.fastest, preferences, 'time');
  const balancedMetrics = evaluateRoute(candidates.balanced, preferences, 'balanced');
  const scored = [
    { result: candidates.lowestFare, metrics: evaluateRoute(candidates.lowestFare, preferences) },
    { result: candidates.balanced, metrics: evaluateRoute(candidates.balanced, preferences) },
    { result: candidates.fastest, metrics: evaluateRoute(candidates.fastest, preferences) },
    { result: candidates.regular, metrics: evaluateRoute(candidates.regular, preferences) },
  ].filter((candidate) => isFiniteRoute(candidate.result));

  const usable = scored.filter((candidate) => canUseRoute(candidate.metrics, preferences));
  const fallback = usable.length > 0 ? usable : scored;
  let selected = fallback.length > 0 ? pickCandidate(fallback) : scored[0];
  let suppressedSavings = false;

  const regularFare = regularMetrics.fare;
  const selectedSavings = regularFare - selected.metrics.fare;
  if (
    preferences.minSavings > 0 &&
    selected.metrics.gateChanges > 0 &&
    selectedSavings < preferences.minSavings &&
    canUseRoute(regularMetrics, preferences)
  ) {
    selected = { result: candidates.regular, metrics: regularMetrics };
    suppressedSavings = true;
  }

  const selectedReason = getSelectedReason(preferences.goal, preferences.accessibilityMode, selected.metrics);
  const tradeoffNotes = getTradeoffNotes({
    selected: selected.metrics,
    lowestFare: lowestFareMetrics,
    regular: regularMetrics,
    fastest: fastestMetrics,
    balanced: balancedMetrics,
    preferences,
    suppressedSavings,
  });

  return {
    result: selected.result,
    insight: {
      selectedReason,
      tradeoffNotes,
      metrics: selected.metrics,
      alternatives: {
        lowestFare: lowestFareMetrics,
        regular: regularMetrics,
        fastest: fastestMetrics,
        balanced: balancedMetrics,
      },
      suppressedSavings,
      accessibilityMode: preferences.accessibilityMode,
    },
  };
}

function getSelectedReason(
  goal: RouteOptimizationGoal,
  accessibilityMode: AccessibilityRouteMode,
  metrics: RouteMetrics,
): string {
  if (accessibilityMode === 'require' && metrics.accessibilityProblemStops === 0) {
    return 'accessibilitySatisfied';
  }
  if (accessibilityMode === 'prefer' && metrics.accessibilityScore >= 0.95) {
    return 'accessibilityPreferred';
  }
  if (goal === 'time') return 'timePriority';
  if (goal === 'balanced') return 'balancedPriority';
  return 'farePriority';
}

function getTradeoffNotes({
  selected,
  lowestFare,
  regular,
  fastest,
  balanced,
  preferences,
  suppressedSavings,
}: {
  selected: RouteMetrics;
  lowestFare: RouteMetrics;
  regular: RouteMetrics;
  fastest: RouteMetrics;
  balanced: RouteMetrics;
  preferences: RoutePlanningPreferences;
  suppressedSavings: boolean;
}): string[] {
  const notes: string[] = [];

  if (suppressedSavings) {
    notes.push('savingsThresholdApplied');
  }
  if (preferences.maxGateChanges !== null && selected.gateChanges <= preferences.maxGateChanges) {
    notes.push('gateLimitSatisfied');
  }
  if (preferences.accessibilityMode !== 'off') {
    notes.push(selected.accessibilityProblemStops === 0 ? 'accessibilityClear' : 'accessibilityPartial');
  }
  if (selected.estimatedMinutes <= fastest.estimatedMinutes + 3) {
    notes.push('nearFastest');
  }
  if (selected.fare <= lowestFare.fare + 0.1) {
    notes.push('nearCheapest');
  }
  if (Math.abs(selected.score - balanced.score) < 0.5) {
    notes.push('balancedTradeoff');
  }
  if (selected.fare < regular.fare) {
    notes.push('beatsRegularFare');
  }

  return Array.from(new Set(notes)).slice(0, 4);
}

export function getReasonText(locale: Locale, reason: string): string {
  const text: Record<string, Record<Locale, string>> = {
    farePriority: {
      en: 'Selected for the lowest fare under your constraints.',
      'zh-Hans': '已按你的限制优先选择低票价路线。',
      'zh-Hant': '已按你的限制優先選擇低票價路線。',
    },
    balancedPriority: {
      en: 'Selected as the best balance of fare, time, and effort.',
      'zh-Hans': '已选择票价、时间和折腾程度更均衡的路线。',
      'zh-Hant': '已選擇票價、時間和折騰程度更均衡的路線。',
    },
    timePriority: {
      en: 'Selected for a faster trip, while still showing the fare tradeoff.',
      'zh-Hans': '已优先选择更快路线，并保留票价取舍提示。',
      'zh-Hant': '已優先選擇更快路線，並保留票價取捨提示。',
    },
    accessibilitySatisfied: {
      en: 'Selected because every checked MTR station satisfies the required accessibility conditions.',
      'zh-Hans': '已选择满足无障碍要求的路线，涉及港铁站均符合已选条件。',
      'zh-Hant': '已選擇滿足無障礙要求的路線，涉及港鐵站均符合已選條件。',
    },
    accessibilityPreferred: {
      en: 'Selected because it keeps the route highly compatible with your accessibility preferences.',
      'zh-Hans': '已优先选择更符合无障碍偏好的路线。',
      'zh-Hant': '已優先選擇更符合無障礙偏好的路線。',
    },
  };
  return text[reason]?.[locale] || text.farePriority[locale];
}

export function getTradeoffText(locale: Locale, note: string): string {
  const text: Record<string, Record<Locale, string>> = {
    savingsThresholdApplied: {
      en: 'Small savings were ignored because they did not meet your minimum savings threshold.',
      'zh-Hans': '节省金额未达到你设置的阈值，因此没有推荐额外出闸方案。',
      'zh-Hant': '節省金額未達到你設定的門檻，因此沒有推薦額外出閘方案。',
    },
    gateLimitSatisfied: {
      en: 'The selected route stays within your gate-change limit.',
      'zh-Hans': '该路线没有超过你设置的出闸次数上限。',
      'zh-Hant': '該路線沒有超過你設定的出閘次數上限。',
    },
    accessibilityClear: {
      en: 'All checked MTR stations match the selected accessibility conditions.',
      'zh-Hans': '路线中检查到的港铁站均符合已选无障碍条件。',
      'zh-Hant': '路線中檢查到的港鐵站均符合已選無障礙條件。',
    },
    accessibilityPartial: {
      en: 'Some MTR stations on this route may not satisfy every accessibility condition.',
      'zh-Hans': '该路线中有部分港铁站可能不完全满足无障碍条件。',
      'zh-Hant': '該路線中有部分港鐵站可能不完全滿足無障礙條件。',
    },
    nearFastest: {
      en: 'Travel time is close to the fastest candidate.',
      'zh-Hans': '预计耗时接近最快候选路线。',
      'zh-Hant': '預計耗時接近最快候選路線。',
    },
    nearCheapest: {
      en: 'Fare is close to the cheapest candidate.',
      'zh-Hans': '票价接近最低票价候选路线。',
      'zh-Hant': '票價接近最低票價候選路線。',
    },
    balancedTradeoff: {
      en: 'The route sits near the best overall tradeoff point.',
      'zh-Hans': '该路线接近综合取舍下的最佳点。',
      'zh-Hant': '該路線接近綜合取捨下的最佳點。',
    },
    beatsRegularFare: {
      en: 'It still saves money compared with the regular ride.',
      'zh-Hans': '相比常规乘车方式仍然可以省钱。',
      'zh-Hant': '相比常規乘車方式仍然可以省錢。',
    },
  };
  return text[note]?.[locale] || note;
}
