import { describe, expect, it } from 'vitest';

import { CITY_CLIMATE, CITY_OPTIONS, createDefaultFloorPlan } from './floorPlanEngine';
import { createSampleProfiles } from './userProfileEngine';

describe('createDefaultFloorPlan', () => {
  it('assigns sample employees to the showcase plan seats', () => {
    const plan = createDefaultFloorPlan();
    const sampleProfileIds = createSampleProfiles().map(profile => profile.id);
    const assignedUserIds = plan.seats
      .map(seat => seat.userId)
      .filter((userId): userId is string => Boolean(userId));

    expect(assignedUserIds.length).toBeGreaterThanOrEqual(4);
    expect(assignedUserIds.every(userId => sampleProfileIds.includes(userId))).toBe(true);
  });
});

describe('city climate options', () => {
  it('maps every dropdown city to a distinct climate profile', () => {
    const climates = CITY_OPTIONS.map(city => CITY_CLIMATE[city]);

    expect(climates.every(Boolean)).toBe(true);
    expect(new Set(climates.map(climate => climate.baseTemp)).size).toBeGreaterThan(2);
    expect(new Set(climates.map(climate => climate.humidity)).size).toBeGreaterThan(2);
    expect(new Set(climates.map(climate => climate.co2Base)).size).toBeGreaterThan(2);
  });
});
