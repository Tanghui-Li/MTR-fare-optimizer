import type { FareMatrix, TicketType, UnifiedFareMatrix } from '../types';

import mtrFaresCsv from '../../opendata/mtr_lines_fares.csv?raw';
import aelFaresCsv from '../../opendata/airport_express_fares.csv?raw';

type CsvRow = Record<string, string>;

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

function addFare(matrix: FareMatrix, from: string, to: string, fare: number) {
  if (!from || !to || !Number.isFinite(fare)) return;
  if (!matrix[from]) matrix[from] = {};
  matrix[from][to] = fare;
}

const AEL_ID_MAP: Record<string, string> = {
  '44': '39',
  '45': '40',
  '46': '42',
};

function normalizeStationId(id: string): string {
  return AEL_ID_MAP[id] ?? id;
}

const fareMatrices: UnifiedFareMatrix = {
  octopus: {},
  single: {},
};

const mtrRows = parseCsv(mtrFaresCsv);
for (const row of mtrRows) {
  const from = normalizeStationId(row.SRC_STATION_ID || '');
  const to = normalizeStationId(row.DEST_STATION_ID || '');
  const octFare = Number(row.OCT_ADT_FARE);
  const singleFare = Number(row.SINGLE_ADT_FARE);
  addFare(fareMatrices.octopus, from, to, octFare);
  addFare(fareMatrices.single, from, to, singleFare);
}

const aelRows = parseCsv(aelFaresCsv);
for (const row of aelRows) {
  const from = normalizeStationId(row.ST_FROM_ID || '');
  const to = normalizeStationId(row.ST_TO_ID || '');
  const octFare = Number(row.OCT_ADT_FARE);
  const singleFare = Number(row.SINGLE_ADT_FARE);
  addFare(fareMatrices.octopus, from, to, octFare);
  addFare(fareMatrices.single, from, to, singleFare);
}

export function getFareMatrix(ticketType: TicketType): FareMatrix {
  return ticketType === 'octopus' ? fareMatrices.octopus : fareMatrices.single;
}
