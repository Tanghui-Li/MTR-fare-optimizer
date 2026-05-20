import linesData from '../lines.json';
import stationsData from '../stations.json';
import { stationCoordinates as stationCoordinatesData } from './stationCoordinates';
import lrtStationsData from './lrtStations.json';
import busStopNamesData from './busStopNames.json';
import { getLocalizedLineName } from './lineColors';

import lightRailFaresCsv from '../../opendata/light_rail_fares.csv?raw';
import lightRailRoutesCsv from '../../opendata/light_rail_routes_and_stops.csv?raw';
import busFaresCsv from '../../opendata/mtr_bus_fares.csv?raw';
import busRoutesCsv from '../../opendata/mtr_bus_routes.csv?raw';
import busStopsCsv from '../../opendata/mtr_bus_stops.csv?raw';

export type NodeKind = 'mtr' | 'lrt' | 'bus';
export type BusCategory = 'nwbus' | 'taipo';
export type TransportMode = 'MTR' | 'AEL' | 'LRT' | 'NWBUS' | 'TAIPOBUS' | 'TRANSFER';

export interface UnifiedNode {
  id: string;
  kind: NodeKind;
  category: TransportMode;
  zh: string;
  en: string;
  lat: number;
  lng: number;
  sourceId?: string;
}

export interface LineDefinition {
  code: string;
  zh: string;
  zhHans: string;
  en: string;
  category: TransportMode;
}

export interface StationOption {
  id: string;
  zh: string;
  en: string;
  category: TransportMode;
}

interface BusStopLocation {
  id: string;
  lat: number;
  lng: number;
  zh: string;
  en: string;
  routes: string[];
  direction?: string;
}

interface CsvRow {
  [key: string]: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  };

  const headers = parseLine(lines[0]).map((value) => value.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseLine(line);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

export const rawLightRailFareRows = parseCsv(lightRailFaresCsv);
export const rawLightRailRouteRows = parseCsv(lightRailRoutesCsv);
export const rawBusFareRows = parseCsv(busFaresCsv);
export const rawBusRouteRows = parseCsv(busRoutesCsv);
export const rawBusStopRows = parseCsv(busStopsCsv);

function buildBusStopLocations(rows: CsvRow[]): BusStopLocation[] {
  const stopMap = new Map<string, { id: string; lat: number; lng: number; zh: string; en: string; routes: Set<string>; direction?: string }>();

  for (const row of rows) {
    const id = row.STATION_ID || '';
    const lat = Number(row.STATION_LATITUDE || '');
    const lng = Number(row.STATION_LONGITUDE || '');
    const zh = row.STATION_NAME_CHI || '';
    const en = row.STATION_NAME_ENG || '';
    const routeId = row.ROUTE_ID || '';
    const direction = row.DIRECTION || '';
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let stop = stopMap.get(id);
    if (!stop) {
      stop = { id, lat, lng, zh, en, routes: new Set<string>(), direction };
      stopMap.set(id, stop);
    }

    if (routeId) stop.routes.add(routeId);
    if (!stop.zh && zh) stop.zh = zh;
    if (!stop.en && en) stop.en = en;
    if (!stop.direction && direction) stop.direction = direction;
  }

  return Array.from(stopMap.values()).map((stop) => ({
    id: stop.id,
    lat: stop.lat,
    lng: stop.lng,
    zh: stop.zh,
    en: stop.en,
    routes: Array.from(stop.routes),
    direction: stop.direction,
  }));
}

function prefixId(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/[()（）,，.。·]/g, '')
    .toLowerCase();
}

function normalizeStationKey(text: string): string {
  const normalized = normalizeText(text);
  return normalized.replace(/^mtr/, '').replace(/station$/, '').replace(/站$/, '');
}

function normalizeRailKey(text: string): string {
  const normalized = normalizeText(text);
  return normalized
    .replace(/^mtr/, '')
    .replace(/^lr/, '')
    .replace(/^lightrail/, '')
    .replace(/stop$/, '')
    .replace(/station$/, '')
    .replace(/站$/, '');
}

export const lineDefinitions: LineDefinition[] = [
  ...Object.entries(linesData as Record<string, { name: { zh: string; en: string } }>).map(([code, info]) => ({
    code,
    zh: info.name.zh,
    zhHans: getLocalizedLineName(code, 'zh-Hans'),
    en: info.name.en,
    category: 'MTR' as TransportMode,
  })),
  { code: 'LRT', zh: '輕鐵', zhHans: '轻铁', en: 'Light Rail', category: 'LRT' },
  { code: 'NWBUS', zh: '港鐵巴士（新界西北）', zhHans: '港铁巴士（新界西北）', en: 'MTR Bus (Northwest New Territories)', category: 'NWBUS' },
  { code: 'TAIPOBUS', zh: '港鐵接駁巴士', zhHans: '港铁接驳巴士', en: 'MTR Feeder Bus', category: 'TAIPOBUS' },
];

export function getLineFilterOptions(): LineDefinition[] {
  return lineDefinitions;
}

export const mtrStationNames = stationsData as Record<string, { zh: string; en: string }>;
export const mtrCoordinates = stationCoordinatesData as Record<string, { lat: number; lng: number }>;
export const lrtStations = lrtStationsData as Record<string, { id: string; zh: string; en: string; lat: number; lng: number }>;
export const busStopLocations = buildBusStopLocations(rawBusStopRows);
export const busStopNames = busStopNamesData as Record<string, { zh: string; en: string }>;

const busStopLocationLookup = new Map<string, BusStopLocation>(busStopLocations.map((stop) => [stop.id, stop]));

const TAIPO_BUS_ROUTES = new Set(['K12', 'K14', 'K17', 'K18']);

export function getBusCategory(routeId: string): BusCategory {
  return TAIPO_BUS_ROUTES.has(routeId) ? 'taipo' : 'nwbus';
}

export function getBusRouteMode(routeId: string): TransportMode {
  return getBusCategory(routeId) === 'taipo' ? 'TAIPOBUS' : 'NWBUS';
}

export function getTransportModeLabel(mode: TransportMode, locale: 'zh-Hant' | 'en' | 'zh-Hans'): string {
  if (mode === 'MTR') return locale === 'en' ? 'MTR' : '港鐵';
  if (mode === 'AEL') return locale === 'en' ? 'Airport Express' : locale === 'zh-Hans' ? '机场快线' : '機場快綫';
  if (mode === 'LRT') return locale === 'en' ? 'Light Rail' : locale === 'zh-Hans' ? '轻铁' : '輕鐵';
  if (mode === 'NWBUS') return locale === 'en' ? 'NW Bus' : locale === 'zh-Hans' ? '新界西北港铁巴士' : '新界西北港鐵巴士';
  if (mode === 'TAIPOBUS') return locale === 'en' ? 'Tai Po Bus' : locale === 'zh-Hans' ? '大埔港铁接驳巴士' : '大埔港鐵接駁巴士';
  return locale === 'en' ? 'Transfer' : locale === 'zh-Hans' ? '换乘' : '轉乘';
}

function buildNodeCatalog() {
  const nodes = new Map<string, UnifiedNode>();

  for (const [id, info] of Object.entries(mtrStationNames)) {
    const coord = mtrCoordinates[id];
    if (!coord) continue;
    nodes.set(id, {
      id,
      kind: 'mtr',
      category: 'MTR',
      zh: info.zh,
      en: info.en,
      lat: coord.lat,
      lng: coord.lng,
      sourceId: id,
    });
  }

  for (const [id, info] of Object.entries(lrtStations)) {
    nodes.set(prefixId('lrt', id), {
      id: prefixId('lrt', id),
      kind: 'lrt',
      category: 'LRT',
      zh: info.zh,
      en: info.en,
      lat: info.lat,
      lng: info.lng,
      sourceId: id,
    });
  }

  for (const stop of busStopLocations) {
    nodes.set(prefixId('bus', stop.id), {
      id: prefixId('bus', stop.id),
      kind: 'bus',
      category: getBusRouteMode(stop.routes[0] ?? ''),
      zh: stop.zh,
      en: stop.en,
      lat: stop.lat,
      lng: stop.lng,
      sourceId: stop.id,
    });
  }

  return nodes;
}

export const nodeCatalog = buildNodeCatalog();

export const unifiedStationMap: Record<string, { zh: string; en: string }> = Object.fromEntries(
  Array.from(nodeCatalog.values()).map((node) => [node.id, { zh: node.zh, en: node.en }]),
);

export const unifiedStationCoordinates: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  Array.from(nodeCatalog.values()).map((node) => [node.id, { lat: node.lat, lng: node.lng }]),
);

export function getNode(id: string): UnifiedNode | undefined {
  return nodeCatalog.get(id);
}

export function getNodeCoordinates(id: string): { lat: number; lng: number } | undefined {
  const node = nodeCatalog.get(id);
  return node ? { lat: node.lat, lng: node.lng } : undefined;
}

export function getNodeLabel(id: string, locale: 'zh-Hant' | 'en' | 'zh-Hans'): string {
  const node = nodeCatalog.get(id);
  if (!node) return id;
  if (locale === 'en') return node.en || node.zh;
  return node.zh || node.en || id;
}

export function getSelectableStations(lineCode: string): StationOption[] {
  const options: StationOption[] = [];

  const getBusStopDisplayNames = (node: UnifiedNode): { zh: string; en: string } => {
    const raw = node.sourceId ? busStopLocationLookup.get(node.sourceId) : undefined;
    if (!raw) return { zh: node.zh, en: node.en };

    const routeLabel = raw.routes.length > 0 ? raw.routes.join('/') : '';
    const directionZh = raw.direction === 'O' ? '去程' : raw.direction === 'I' ? '回程' : '';
    const directionEn = raw.direction === 'O' ? 'Outbound' : raw.direction === 'I' ? 'Inbound' : '';
    const zhParts = [routeLabel, directionZh].filter(Boolean);
    const enParts = [routeLabel, directionEn].filter(Boolean);
    if (zhParts.length === 0 && enParts.length === 0) return { zh: node.zh, en: node.en };

    return {
      zh: `${node.zh} (${zhParts.join(' ')})`,
      en: `${node.en} (${enParts.join(' ')})`,
    };
  };

  if (lineCode === 'LRT') {
    for (const node of nodeCatalog.values()) {
      if (node.kind === 'lrt') {
        options.push({ id: node.id, zh: node.zh, en: node.en, category: 'LRT' });
      }
    }
    return options;
  }

  if (lineCode === 'NWBUS' || lineCode === 'TAIPOBUS') {
    for (const node of nodeCatalog.values()) {
      if (node.kind === 'bus' && node.category === lineCode) {
        const display = getBusStopDisplayNames(node);
        options.push({ id: node.id, zh: display.zh, en: display.en, category: lineCode as TransportMode });
      }
    }
    return options;
  }

  if (lineCode === 'ALL') {
    for (const node of nodeCatalog.values()) {
      if (node.kind === 'bus') {
        const display = getBusStopDisplayNames(node);
        options.push({ id: node.id, zh: display.zh, en: display.en, category: node.category });
      } else {
        options.push({ id: node.id, zh: node.zh, en: node.en, category: node.category });
      }
    }
    options.sort((a, b) => a.zh.localeCompare(b.zh, 'zh-HK'));
    return options;
  }

  const lineStations = (linesData as Record<string, { stations: string[] }>)[lineCode]?.stations || [];
  for (const stationId of lineStations) {
    const node = nodeCatalog.get(stationId);
    if (node) {
      options.push({ id: node.id, zh: node.zh, en: node.en, category: 'MTR' });
    }
  }
  return options;
}

export function getLocalizedLineDefinitionLabel(definition: LineDefinition, locale: 'zh-Hant' | 'en' | 'zh-Hans'): string {
  if (locale === 'en') return definition.en;
  if (locale === 'zh-Hans') return definition.zhHans || definition.zh;
  return definition.zh;
}

export function isMtrNode(id: string): boolean {
  return !id.startsWith('lrt:') && !id.startsWith('bus:');
}

export function isLrtNode(id: string): boolean {
  return id.startsWith('lrt:');
}

export function isBusNode(id: string): boolean {
  return id.startsWith('bus:');
}

export function getBusNodeRouteIds(nodeId: string): string[] {
  const node = nodeCatalog.get(nodeId);
  if (!node || node.kind !== 'bus') return [];
  const raw = busStopLocations.find((stop) => stop.id === node.sourceId);
  return raw?.routes || [];
}

function extractBusStopMtrName(zh: string, en: string): string | null {
  const zhMatch = zh.match(/港鐵([^()（）]+?)站/);
  if (zhMatch) return zhMatch[1].trim();
  const zhBase = zh.split(/[()（）]/)[0].trim();
  if (zhBase.endsWith('站')) return zhBase.slice(0, -1).trim();

  const enMatch = en.match(/MTR\s+(.+?)\s+Station/i);
  if (enMatch) return enMatch[1].trim();
  const enBase = en.split('(')[0].trim();
  if (/\sStation$/i.test(enBase)) {
    return enBase.replace(/\sStation$/i, '').trim();
  }

  return null;
}

function extractBusStopLrtName(zh: string, en: string): string | null {
  const zhMatch = zh.match(/輕鐵([^()（）]+?)站/);
  if (zhMatch) return zhMatch[1].trim();
  if (zh.includes('輕鐵')) {
    return zh.replace(/輕鐵/g, '').replace(/站/g, '').split(/[()（）]/)[0].trim();
  }

  const enMatch = en.match(/LR\s+(.+?)\s+Stop/i);
  if (enMatch) return enMatch[1].trim();
  const enLightRailMatch = en.match(/Light\s*Rail\s+(.+?)\s+Stop/i);
  if (enLightRailMatch) return enLightRailMatch[1].trim();
  if (/\bLR\b/i.test(en) && /Stop/i.test(en)) {
    return en.replace(/\bLR\b/i, '').replace(/Stop/i, '').split('(')[0].trim();
  }

  return null;
}

export function getExplicitBusMtrTransfers(): Array<{ busId: string; mtrId: string }> {
  const mtrLookup = new Map<string, string>();
  for (const [id, info] of Object.entries(mtrStationNames)) {
    const zhKey = normalizeStationKey(info.zh || '');
    if (zhKey) mtrLookup.set(zhKey, id);
    const enKey = normalizeStationKey(info.en || '');
    if (enKey) mtrLookup.set(enKey, id);
  }

  const results: Array<{ busId: string; mtrId: string }> = [];
  const seen = new Set<string>();

  for (const node of nodeCatalog.values()) {
    if (node.kind !== 'bus') continue;
    const candidate = extractBusStopMtrName(node.zh, node.en);
    if (!candidate) continue;
    const key = normalizeStationKey(candidate);
    const mtrId = mtrLookup.get(key);
    if (!mtrId) continue;
    const unique = `${node.id}|${mtrId}`;
    if (seen.has(unique)) continue;
    seen.add(unique);
    results.push({ busId: node.id, mtrId });
  }

  return results;
}

export function getExplicitBusLrtTransfers(): Array<{ busId: string; lrtId: string }> {
  const lrtLookup = new Map<string, string>();
  for (const [id, info] of Object.entries(lrtStations)) {
    const zhKey = normalizeRailKey(info.zh || '');
    if (zhKey) lrtLookup.set(zhKey, id);
    const enKey = normalizeRailKey(info.en || '');
    if (enKey) lrtLookup.set(enKey, id);
  }

  const results: Array<{ busId: string; lrtId: string }> = [];
  const seen = new Set<string>();

  for (const node of nodeCatalog.values()) {
    if (node.kind !== 'bus') continue;
    const candidate = extractBusStopLrtName(node.zh, node.en);
    if (!candidate) continue;
    const key = normalizeRailKey(candidate);
    const lrtId = lrtLookup.get(key);
    if (!lrtId) continue;
    const unique = `${node.id}|${lrtId}`;
    if (seen.has(unique)) continue;
    seen.add(unique);
    results.push({ busId: node.id, lrtId });
  }

  return results;
}

export function getHubKey(nodeId: string): string | null {
  const node = nodeCatalog.get(nodeId);
  const lrtHubMap: Record<string, string> = {
    '100': 'siu-hong',
    '295': 'tuen-mun',
    '430': 'tin-shui-wai',
    '600': 'yuen-long',
  };
  if (!node) {
    if (nodeId.startsWith('lrt:')) {
      const lrtStopId = nodeId.slice(4).padStart(3, '0');
      return lrtHubMap[lrtStopId] || null;
    }
    return null;
  }

  if (node.kind === 'mtr') {
    const directHubMap: Record<string, string> = {
      '116': 'yuen-long',
      '117': 'long-ping',
      '118': 'tin-shui-wai',
      '119': 'siu-hong',
      '120': 'tuen-mun',
      '72': 'tai-po-market',
    };
    return directHubMap[node.id] || null;
  }

  if (node.kind === 'lrt') {
    const lrtStopId = (node.sourceId || '').padStart(3, '0');
    return lrtHubMap[lrtStopId] || null;
  }

  // Do not infer bus interchanges by stop name; only explicit mappings are allowed.
  if (node.kind === 'bus') {
    return null;
  }
  return null;
}

export function cleanBusArrivalText(text: string): string {
  const trimmed = text.trim();
  if (/^(即將開出|已離開|到達|已到達|到达|即將到站)$/u.test(trimmed)) {
    return trimmed.replace(/到達|到达/g, '').trim();
  }
  return trimmed;
}

