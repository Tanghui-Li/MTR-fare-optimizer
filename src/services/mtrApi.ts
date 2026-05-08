/**
 * MTR Open Data API 服务层
 * 所有数据均来自香港政府官方开放数据 (rt.data.gov.hk)
 */

// ==================== MTR Next Train ====================

export interface NextTrainEntry {
  seq: string;
  dest: string;   // Station code e.g. "TSW"
  plat: string;    // Platform number
  time: string;    // "2026-05-07 21:08:49"
  ttnt: string;    // Time to next train in minutes
  valid: string;   // "Y" or "N"
  source: string;
}

export interface NextTrainData {
  UP?: NextTrainEntry[];
  DOWN?: NextTrainEntry[];
  curr_time: string;
  sys_time: string;
}

export interface NextTrainResponse {
  status: number;
  message: string;
  data: Record<string, NextTrainData>;
  isdelay: string;
  sys_time: string;
  curr_time: string;
}

/**
 * 获取即将到站的列车信息
 * API: GET https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php
 * @param line - Line code (e.g. "TWL", "ISL")
 * @param station - Station code (e.g. "TST", "CEN")
 */
export async function fetchNextTrain(
  line: string,
  station: string,
): Promise<NextTrainResponse> {
  const url = `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(station)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Next Train API error: ${resp.status}`);
  return resp.json();
}

// ==================== MTR Bus ====================

export interface BusLocation {
  latitude: number;
  longitude: number;
}

export interface BusEntry {
  arrivalTimeInSecond: string;
  arrivalTimeText: string;
  busId: string;
  busLocation: BusLocation;
  busRemark: string | null;
  departureTimeInSecond: string;
  departureTimeText: string;
  isDelayed: string;
  isScheduled: string;
  lineRef: string;
}

export interface BusStop {
  bus: BusEntry[];
  busStopId: string;
  isSuspended: string;
}

export interface MtrBusResponse {
  appRefreshTimeInSecond: string;
  busStop: BusStop[];
  routeName?: string;
  caseNumber?: number;
  routeStatusColour?: string;
  routeStatusRemarkTitle?: string;
  routeStatusRemarkDetail?: string;
  routeStatusRemarkUrl?: string;
  status?: number;
}

/**
 * 获取港铁巴士实时到站及位置信息
 * API: POST https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule
 * @param routeName - Route name (e.g. "K12", "506")
 */
export async function fetchMtrBusSchedule(
  routeName: string,
): Promise<MtrBusResponse> {
  const url = 'https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'zh', routeName }),
  });
  if (!resp.ok) throw new Error(`MTR Bus API error: ${resp.status}`);
  return resp.json();
}

// ==================== Helper: Station code -> name mapping ====================

/**
 * MTR station codes used by the Next Train API
 * Maps Station Code (3-letter) -> Station ID (numeric from stations.json)
 */
export const stationCodeToId: Record<string, string> = {
  // Island Line
  KET: '83', HKU: '82', SYP: '81', SHW: '26', CEN: '1', ADM: '2',
  WAC: '27', CAB: '28', TIH: '29', FOH: '30', NOP: '31', QUB: '32',
  TAK: '33', SWH: '34', SKW: '35', HFC: '36', CHW: '37',
  // Kwun Tong Line
  WHA: '85', HOM: '84', YMT: '5', MOK: '6', PRE: '16', SKM: '7',
  KOT: '8', LOF: '9', WTS: '10', DIH: '11', CHH: '12', KOB: '13',
  NTK: '14', KWT: '15', LAT: '38', YAT: '48', TIK: '49',
  // Tsuen Wan Line
  TST: '3', JOR: '4', SSP: '17', CSW: '18', LCK: '19', MEF: '20',
  LAK: '21', KWF: '22', KWH: '23', TWH: '24', TSW: '25',
  // Tung Chung Line
  HOK: '39', KOW: '40', OLY: '41', NAC: '53', TSY: '42', SUN: '54', TUC: '43',
  // Airport Express
  AIR: '47', AWE: '56',
  // Disneyland Resort Line
  DIS: '55',
  // Tseung Kwan O Line
  TKO: '50', HAH: '51', POA: '52', LHP: '57',
  // East Rail Line
  LOW: '76', SHS: '75', FAN: '74', TWO: '73', TAP: '72', UNI: '71',
  FOT: '69', SHT: '68', TAW: '67', MKK: '65', HUH: '64',
  EXC: '94', LMC: '78',
  // Tuen Ma Line
  WKS: '103', MOS: '102', HEO: '101', TSH: '100', SHM: '99',
  CIO: '98', STW: '97', CKT: '96', HIK: '90',
  KAT: '91', SUW: '92', TKW: '93',
  ETS: '80', AUS: '111',
  TWW: '114', KSR: '115', YUL: '116', LOP: '117',
  TIS: '118', SIH: '119', TUM: '120',
  // South Island Line
  OCP: '86', WCH: '87', LET: '88', SOH: '89',
};

/**
 * Reverse mapping: Station ID -> Station Code(s)
 */
export const stationIdToCode: Record<string, string> = {};
for (const [code, id] of Object.entries(stationCodeToId)) {
  // Keep the first mapping (some stations have same ID but different codes
  // due to line intersections - this is fine for our display purposes)
  if (!stationIdToCode[id]) {
    stationIdToCode[id] = code;
  }
}

/**
 * Maps station ID to the lines it belongs to
 * Returns all line codes for a given station ID
 */
export function getStationLines(
  linesData: Record<string, { stations: string[] }>
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [lineCode, lineInfo] of Object.entries(linesData)) {
    for (const stationId of lineInfo.stations) {
      if (!result[stationId]) result[stationId] = [];
      if (!result[stationId].includes(lineCode)) {
        result[stationId].push(lineCode);
      }
    }
  }
  return result;
}

// ==================== Light Rail ====================

export interface LrtNextTrain {
  arrival_departure: string; 
  dest_en: string;
  dest_ch: string;
  time_en: string;
  time_ch: string;
  route_no: string;
  train_length: number;
}

export interface LrtPlatform {
  platform_id: number;
  route_list: LrtNextTrain[];
}

export interface LrtScheduleResponse {
  status: number;
  system_time: string;
  platform_list: LrtPlatform[];
}

/**
 * 获取轻铁实时到站信息
 * API: GET https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id={id}
 */
export async function fetchLrtSchedule(
  stationId: string | number,
): Promise<LrtScheduleResponse> {
  const url = `https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${stationId}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`LRT API error: ${resp.status}`);
  return resp.json();
}
