import { describe, expect, it } from 'vitest';
import accessibilityRaw from './accessibilityData.json';
import busStopNamesRaw from './busStopNames.json';
import lrtStationsRaw from './lrtStations.json';
import stationsRaw from './stations.json';
import { getZhHansText } from './zhHansText';

const accessibilityData = accessibilityRaw as {
  facilities: Record<string, Record<string, true | { zh: string; en: string }>>;
  categories: Record<string, { catZh: string; zh: string }>;
};

describe('manual zh-Hans translations', () => {
  it('covers MTR and Light Rail station names', () => {
    const missing = new Set<string>();

    for (const station of Object.values(stationsRaw as Record<string, { zh: string }>)) {
      if (!getZhHansText(station.zh)) missing.add(station.zh);
    }

    for (const station of Object.values(lrtStationsRaw as Record<string, { zh: string }>)) {
      if (!getZhHansText(station.zh)) missing.add(station.zh);
    }

    expect(Array.from(missing).sort()).toEqual([]);
  });

  it('covers MTR bus stop names', () => {
    const missing = new Set<string>();

    for (const stop of Object.values(busStopNamesRaw as Record<string, { zh: string }>)) {
      if (!getZhHansText(stop.zh)) missing.add(stop.zh);
    }

    expect(Array.from(missing).sort()).toEqual([]);
  });

  it('covers accessibility category, facility and detail text', () => {
    const missing = new Set<string>();

    for (const category of Object.values(accessibilityData.categories)) {
      if (!getZhHansText(category.catZh)) missing.add(category.catZh);
      if (!getZhHansText(category.zh)) missing.add(category.zh);
    }

    for (const facilities of Object.values(accessibilityData.facilities)) {
      for (const value of Object.values(facilities)) {
        if (value !== true && !getZhHansText(value.zh)) {
          missing.add(value.zh);
        }
      }
    }

    expect(Array.from(missing).sort()).toEqual([]);
  });
});
