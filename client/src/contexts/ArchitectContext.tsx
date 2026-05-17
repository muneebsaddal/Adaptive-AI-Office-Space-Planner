/**
 * ArchitectContext — Global state for the Architect Tool
 * Manages floor plan + employee profiles + scenario comparison
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { FloorPlan, createDefaultFloorPlan, createDefaultAfterPlan } from '@/lib/floorPlanEngine';
import { UserProfile, DEFAULT_PREFERENCES_BY_ACTIVITY, applyHealthAdjustments, EnvironmentalPreferences, calculateComfortMatch, createSampleProfiles } from '@/lib/userProfileEngine';
import { calculateSeatEnvironment, Seat } from '@/lib/floorPlanEngine';

// ─── Season & Time Types ─────────────────────────────────────────────────────

export type Season = 'summer' | 'autumn' | 'winter' | 'spring';

export const SEASON_LABELS: Record<Season, string> = {
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  spring: 'Spring',
};

export const SEASON_MONTH: Record<Season, number> = {
  summer: 7,   // July
  autumn: 10,  // October
  winter: 1,   // January
  spring: 4,   // April
};

export const SEASON_ICONS: Record<Season, string> = {
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
  spring: '🌸',
};

// ─── Context ─────────────────────────────────────────────────────────────────

interface ArchitectContextType {
  plan: FloorPlan;
  setPlan: (plan: FloorPlan) => void;
  planAfter: FloorPlan;
  setPlanAfter: (plan: FloorPlan) => void;
  profiles: UserProfile[];
  addProfile: (profile: UserProfile) => void;
  updateProfile: (id: string, updates: Partial<UserProfile>) => void;
  deleteProfile: (id: string) => void;
  selectedSeatId: string | null;
  setSelectedSeatId: (id: string | null) => void;
  city: string;
  setCity: (city: string) => void;
  activeTab: 'plan' | 'diagnosis' | 'generation' | 'comparison';
  setActiveTab: (tab: 'plan' | 'diagnosis' | 'generation' | 'comparison') => void;
  // Time & Season
  hourOfDay: number;        // 8–18
  setHourOfDay: (h: number) => void;
  season: Season;
  setSeason: (s: Season) => void;
  // Derived simulation date (used by daylightEngine)
  simulationDate: Date;
}

const ArchitectContext = createContext<ArchitectContextType | null>(null);

function inferPreferredZones(profile: UserProfile): string[] {
  const zones = new Set<string>();

  if (profile.primaryActivity === 'deep_focus' || profile.primaryActivity === 'learning') {
    zones.add('quiet');
    zones.add('interior');
    zones.add('north');
  }

  if (profile.primaryActivity === 'collaborative' || profile.primaryActivity === 'meeting') {
    zones.add('collaborative');
    zones.add('central');
    zones.add('bright');
  }

  if (profile.primaryActivity === 'creative') {
    zones.add('bright');
    zones.add('near-window');
    zones.add('edge');
  }

  if (profile.primaryActivity === 'administrative') {
    zones.add('balanced');
    zones.add('central');
  }

  if (profile.healthConditions.includes('heat_sensitive')) {
    zones.add('cool');
    zones.add('north');
    zones.add('interior');
  }

  if (profile.healthConditions.includes('cold_sensitive')) {
    zones.add('warm');
    zones.add('south');
    zones.add('near-window');
  }

  if (profile.healthConditions.includes('asthma')) {
    zones.add('ventilated');
    zones.add('near-window');
  }

  if (profile.healthConditions.includes('migraine') || profile.healthConditions.includes('eye_strain')) {
    zones.add('soft-light');
    zones.add('quiet');
  }

  if (profile.workStyle === 'introvert') {
    zones.add('quiet');
  }

  if (profile.workStyle === 'extrovert') {
    zones.add('social');
  }

  return Array.from(zones);
}

function seatEnvironmentTags(seat: Seat, plan: FloorPlan, city: string, simulationDate: Date) {
  const env = calculateSeatEnvironment(seat, plan, city, simulationDate);
  const tags = new Set<string>();

  if (env.nearestWindowOrientation) {
    tags.add(env.nearestWindowOrientation);
    tags.add(`${env.nearestWindowOrientation}-window`);
  }

  if (env.nearestExteriorOrientation) {
    tags.add(`exterior-${env.nearestExteriorOrientation}`);
  }

  if (env.distanceToNearestWindow <= 3) tags.add('near-window');
  if (env.distanceToNearestWindow >= 6) tags.add('far-window');

  if (env.distanceToExteriorWall <= 2.5) tags.add('perimeter');
  if (env.distanceToExteriorWall >= 3.5) tags.add('interior');
  if (env.distanceToExteriorWall >= 4.5) tags.add('quiet');

  if (env.estimatedIlluminance >= 450) tags.add('bright');
  if (env.estimatedIlluminance <= 320) tags.add('soft-light');

  if (env.estimatedTemperature <= 23) tags.add('cool');
  if (env.estimatedTemperature >= 25) tags.add('warm');

  if (env.estimatedNoise <= 45) tags.add('quiet');
  if (env.estimatedNoise >= 52) tags.add('social');

  if (env.estimatedCO2 <= 850) tags.add('ventilated');
  if (env.distanceToExteriorWall >= 4 && env.distanceToNearestWindow >= 4) tags.add('central');

  return { env, tags: Array.from(tags) };
}

function scoreSeatForProfile(profile: UserProfile, seat: Seat, plan: FloorPlan, city: string, simulationDate: Date) {
  const { env, tags } = seatEnvironmentTags(seat, plan, city, simulationDate);
  const sensorData = {
    temperature: env.estimatedTemperature,
    illuminance: env.estimatedIlluminance,
    noise: env.estimatedNoise,
    co2: env.estimatedCO2,
    humidity: env.estimatedHumidity,
  };

  const comfort = calculateComfortMatch(profile, sensorData).overall;
  const preferredZones = profile.preferredZones.length > 0 ? profile.preferredZones : inferPreferredZones(profile);
  const matches = preferredZones.filter(zone => tags.includes(zone)).length;
  const zoneBonus = Math.min(20, matches * 6);
  const fitPenalty = preferredZones.length > 0 && matches === 0 ? 6 : 0;

  return {
    seat,
    env,
    score: comfort + zoneBonus - fitPenalty,
  };
}

function getPlanBounds(plan: FloorPlan) {
  const wallXs = plan.walls.flatMap(w => [w.x1, w.x2]);
  const wallYs = plan.walls.flatMap(w => [w.y1, w.y2]);
  const cadLineXs = plan.cadGeometry?.lines.flatMap(line => [line.x1, line.x2]) ?? [];
  const cadLineYs = plan.cadGeometry?.lines.flatMap(line => [line.y1, line.y2]) ?? [];
  const cadPolyXs = plan.cadGeometry?.polylines.flatMap(polyline => polyline.points.map(point => point.x)) ?? [];
  const cadPolyYs = plan.cadGeometry?.polylines.flatMap(polyline => polyline.points.map(point => point.y)) ?? [];

  const xs = [...wallXs, ...cadLineXs, ...cadPolyXs];
  const ys = [...wallYs, ...cadLineYs, ...cadPolyYs];

  return {
    minX: xs.length > 0 ? Math.min(...xs) : 0,
    maxX: xs.length > 0 ? Math.max(...xs) : plan.width,
    minY: ys.length > 0 ? Math.min(...ys) : 0,
    maxY: ys.length > 0 ? Math.max(...ys) : plan.height,
  };
}

function clampSeatToPlanBounds(seat: Seat, plan: FloorPlan): Seat {
  const bounds = getPlanBounds(plan);
  const pad = 24;
  const minX = Math.min(bounds.minX + pad, bounds.maxX - pad);
  const maxX = Math.max(bounds.minX + pad, bounds.maxX - pad);
  const minY = Math.min(bounds.minY + pad, bounds.maxY - pad);
  const maxY = Math.max(bounds.minY + pad, bounds.maxY - pad);

  return {
    ...seat,
    x: Math.max(minX, Math.min(maxX, seat.x)),
    y: Math.max(minY, Math.min(maxY, seat.y)),
  };
}

function isSeatInSafeZone(seat: Seat, plan: FloorPlan, city: string, simulationDate: Date) {
  const { env } = seatEnvironmentTags(seat, plan, city, simulationDate);
  const bounds = getPlanBounds(plan);
  const insetX = Math.max(40, (bounds.maxX - bounds.minX) * 0.12);
  const insetY = Math.max(40, (bounds.maxY - bounds.minY) * 0.12);

  return (
    seat.x >= bounds.minX + insetX &&
    seat.x <= bounds.maxX - insetX &&
    seat.y >= bounds.minY + insetY &&
    seat.y <= bounds.maxY - insetY &&
    env.distanceToExteriorWall >= 3 &&
    env.distanceToNearestWindow >= 1.5
  );
}

function createBestSeatForProfile(
  profile: UserProfile,
  plan: FloorPlan,
  city: string,
  simulationDate: Date
): Seat | null {
  const bounds = getPlanBounds(plan);
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const columns = 5;
  const rows = 4;
  const insetX = Math.max(60, spanX * 0.18);
  const insetY = Math.max(60, spanY * 0.16);
  const rawMinX = bounds.minX + insetX;
  const rawMaxX = bounds.maxX - insetX;
  const rawMinY = bounds.minY + insetY;
  const rawMaxY = bounds.maxY - insetY;
  const safeMinX = Math.min(rawMinX, rawMaxX);
  const safeMaxX = Math.max(rawMinX, rawMaxX);
  const safeMinY = Math.min(rawMinY, rawMaxY);
  const safeMaxY = Math.max(rawMinY, rawMaxY);

  const candidates: Seat[] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = Math.round(safeMinX + ((safeMaxX - safeMinX) * (col + 1)) / (columns + 1));
      const y = Math.round(safeMinY + ((safeMaxY - safeMinY) * (row + 1)) / (rows + 1));
      candidates.push({
        id: `seat-${nanoid(8)}-${index++}`,
        userId: profile.id,
        x,
        y,
        label: `${profile.name} - `,
      });
    }
  }

  candidates.push({
    id: `seat-${nanoid(8)}-${index++}`,
    userId: profile.id,
    x: Math.round((safeMinX + safeMaxX) / 2),
    y: Math.round((safeMinY + safeMaxY) / 2),
    label: `${profile.name} - `,
  });

  const ranked = candidates
    .map(seat => scoreSeatForProfile(profile, seat, plan, city, simulationDate))
    .sort((a, b) => b.score - a.score);
  const safeRanked = ranked.filter(({ seat }) => isSeatInSafeZone(seat, plan, city, simulationDate));

  const best = safeRanked[0]?.seat ?? ranked[0]?.seat ?? null;
  return best ? clampSeatToPlanBounds(best, plan) : null;
}

function placeProfileOnPlan(
  profile: UserProfile,
  plan: FloorPlan,
  city: string,
  simulationDate: Date
): { plan: FloorPlan; seatId: string | null } {
  const availableSeats = plan.seats.filter(seat => !seat.userId);
  const rankedExisting = availableSeats
    .map(seat => scoreSeatForProfile(profile, seat, plan, city, simulationDate))
    .sort((a, b) => b.score - a.score);
  const bestExisting =
    rankedExisting.find(({ seat }) => isSeatInSafeZone(seat, plan, city, simulationDate))?.seat ??
    rankedExisting[0]?.seat ??
    null;
  if (bestExisting) {
    const clampedExisting = clampSeatToPlanBounds(bestExisting, plan);
    const nextPlan: FloorPlan = {
      ...plan,
      seats: plan.seats.map(seat =>
        seat.id === bestExisting.id ? { ...clampedExisting, userId: profile.id } : seat
      ),
    };
    return { plan: nextPlan, seatId: bestExisting.id };
  }

  const generatedSeat = createBestSeatForProfile(profile, plan, city, simulationDate);
  if (!generatedSeat) {
    const fallbackSeat: Seat = {
      id: `seat-${nanoid(10)}`,
      userId: profile.id,
      x: Math.round(plan.width / 2),
      y: Math.round(plan.height / 2),
      label: `${profile.name} - `,
    };
    const clampedFallback = clampSeatToPlanBounds(fallbackSeat, plan);
    return {
      plan: {
        ...plan,
        seats: [...plan.seats, clampedFallback],
      },
      seatId: clampedFallback.id,
    };
  }

  const clampedGenerated = clampSeatToPlanBounds(generatedSeat, plan);
  return {
    plan: {
      ...plan,
      seats: [...plan.seats, clampedGenerated],
    },
    seatId: clampedGenerated.id,
  };
}

export function ArchitectProvider({ children }: { children: React.ReactNode }) {
  const defaultPlan = createDefaultFloorPlan();

  const [plan, setPlan] = useState<FloorPlan>(defaultPlan);
  const [planAfter, setPlanAfter] = useState<FloorPlan>(() => {
    return createDefaultAfterPlan(defaultPlan);
  });
  const [profiles, setProfiles] = useState<UserProfile[]>(() => createSampleProfiles());
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [city, setCity] = useState('Riyadh');
  const [activeTab, setActiveTab] = useState<'plan' | 'diagnosis' | 'generation' | 'comparison'>('plan');
  const [hourOfDay, setHourOfDay] = useState(10); // 10am default
  const [season, setSeason] = useState<Season>('summer');

  // Build a Date object representing the simulation time
  const simulationDate = React.useMemo(() => {
    const d = new Date();
    d.setMonth(SEASON_MONTH[season] - 1);
    d.setDate(15);
    d.setHours(hourOfDay, 0, 0, 0);
    return d;
  }, [hourOfDay, season]);

  const addProfile = useCallback((profile: UserProfile) => {
    const enrichedProfile = profile.preferredZones.length > 0
      ? profile
      : { ...profile, preferredZones: inferPreferredZones(profile) };
    const { plan: nextPlan, seatId } = placeProfileOnPlan(enrichedProfile, plan, city, simulationDate);

    setProfiles(prev => [...prev, enrichedProfile]);
    setPlan(nextPlan);
    setSelectedSeatId(seatId);
  }, [city, plan, simulationDate]);

  const updateProfile = useCallback((id: string, updates: Partial<UserProfile>) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    setPlan(prev => ({
      ...prev,
      seats: prev.seats.map(seat => seat.userId === id ? { ...seat, userId: null } : seat),
    }));
  }, []);

  useEffect(() => {
    if (profiles.length === 0) return;

    setPlan(prevPlan => {
      const occupied = new Set(
        prevPlan.seats
          .map(seat => seat.userId)
          .filter((id): id is string => Boolean(id))
      );

      const unplacedProfiles = profiles.filter(profile => !occupied.has(profile.id));
      if (unplacedProfiles.length === 0) return prevPlan;

      let nextPlan = prevPlan;
      let changed = false;

      for (const profile of unplacedProfiles) {
        const result = placeProfileOnPlan(profile, nextPlan, city, simulationDate);
        if (result.seatId) {
          nextPlan = result.plan;
          changed = true;
        }
      }

      return changed ? nextPlan : prevPlan;
    });
  }, [profiles, city, simulationDate]);

  return (
    <ArchitectContext.Provider value={{
      plan, setPlan,
      planAfter, setPlanAfter,
      profiles, addProfile, updateProfile, deleteProfile,
      selectedSeatId, setSelectedSeatId,
      city, setCity,
      activeTab, setActiveTab,
      hourOfDay, setHourOfDay,
      season, setSeason,
      simulationDate,
    }}>
      {children}
    </ArchitectContext.Provider>
  );
}

export function useArchitect() {
  const ctx = useContext(ArchitectContext);
  if (!ctx) throw new Error('useArchitect must be used inside ArchitectProvider');
  return ctx;
}
