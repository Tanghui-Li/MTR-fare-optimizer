import linesData from '../lines.json';
import stationsData from '../stations.json';
import { stationCoordinates as stationCoordinatesData } from './stationCoordinates';
import lrtStationsData from './lrtStations.json';
import busStopLocationsData from './busStopLocations.json';
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

function prefixId(prefix: string, id: string): string {
  return `${prefix}:${id}`;
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
export const busStopLocations = busStopLocationsData as Array<{ id: string; lat: number; lng: number; zh: string; en: string; routes: string[] }>;
export const busStopNames = busStopNamesData as Record<string, { zh: string; en: string }>;

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
        options.push({ id: node.id, zh: node.zh, en: node.en, category: lineCode as TransportMode });
      }
    }
    return options;
  }

  if (lineCode === 'ALL') {
    for (const node of nodeCatalog.values()) {
      options.push({ id: node.id, zh: node.zh, en: node.en, category: node.category });
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

export const rawLightRailFareRows = parseCsv(lightRailFaresCsv);
export const rawLightRailRouteRows = parseCsv(lightRailRoutesCsv);
export const rawBusFareRows = parseCsv(busFaresCsv);
export const rawBusRouteRows = parseCsv(busRoutesCsv);
export const rawBusStopRows = parseCsv(busStopsCsv);
