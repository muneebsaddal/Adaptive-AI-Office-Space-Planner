/**
 * Architect Engine — comfort Adaptive Space Planning
 * ===================================================
 * Three tools for the architect:
 * 1. DIAGNOSIS   — gap between each employee's preferences and their seat environment
 * 2. GENERATION  — design recommendations card based on all employees
 * 3. COMPARISON  — before/after comfort scores when design changes
 */

import { UserProfile, calculateComfortMatch, ComfortMatch } from './userProfileEngine';
import { Seat, FloorPlan, SeatEnvironment, calculateSeatEnvironment, Window } from './floorPlanEngine';

// ─── DIAGNOSIS ───────────────────────────────────────────────────────────────

export interface EmployeeDiagnosis {
  userId: string;
  userName: string;
  userRole: string;
  userAvatar: string;
  seatId: string;
  seatLabel: string;
  environment: SeatEnvironment;
  comfortMatch: ComfortMatch;
  gaps: Gap[];
  interventions: Intervention[];
}

export interface Gap {
  parameter: 'temperature' | 'illuminance' | 'noise' | 'co2' | 'humidity';
  labelAr: string;
  current: number;
  preferred: number;
  unit: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  direction: 'too_high' | 'too_low' | 'ok';
}

export interface Intervention {
  id: string;
  type: 'relocate' | 'glazing' | 'partition' | 'lighting' | 'ventilation' | 'shading';
  titleAr: string;
  descriptionAr: string;
  criteria: string;
  expectedImprovement: number; // % comfort score improvement
  priority: 'critical' | 'high' | 'medium';
}

const GAP_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  illuminance: 'Illuminance',
  noise: 'Noise level',
  co2: 'Air quality (CO2)',
  humidity: 'Humidity',
};

const GAP_UNITS: Record<string, string> = {
  temperature: '°C',
  illuminance: 'lux',
  noise: 'dB',
  co2: 'ppm',
  humidity: '%',
};

function classifyGapSeverity(diff: number, tolerance: number): 'critical' | 'high' | 'medium' | 'low' {
  const ratio = Math.abs(diff) / tolerance;
  if (ratio > 3) return 'critical';
  if (ratio > 2) return 'high';
  if (ratio > 1) return 'medium';
  return 'low';
}

export function diagnoseEmployee(
  profile: UserProfile,
  seat: Seat,
  env: SeatEnvironment
): EmployeeDiagnosis {
  const p = profile.preferences;

  const sensorData = {
    temperature: env.estimatedTemperature,
    illuminance: env.estimatedIlluminance,
    noise: env.estimatedNoise,
    co2: env.estimatedCO2,
    humidity: env.estimatedHumidity,
  };

  const comfortMatch = calculateComfortMatch(profile, sensorData);

  // Build gaps
  const gaps: Gap[] = [];

  const tempDiff = env.estimatedTemperature - p.temperaturePreferred;
  if (Math.abs(tempDiff) > p.temperatureTolerance * 0.5) {
    gaps.push({
      parameter: 'temperature',
      labelAr: GAP_LABELS.temperature,
      current: env.estimatedTemperature,
      preferred: p.temperaturePreferred,
      unit: GAP_UNITS.temperature,
      severity: classifyGapSeverity(tempDiff, p.temperatureTolerance),
      direction: tempDiff > 0 ? 'too_high' : 'too_low',
    });
  }

  const luxDiff = env.estimatedIlluminance - p.illuminancePreferred;
  if (Math.abs(luxDiff) > p.illuminanceTolerance * 0.5) {
    gaps.push({
      parameter: 'illuminance',
      labelAr: GAP_LABELS.illuminance,
      current: env.estimatedIlluminance,
      preferred: p.illuminancePreferred,
      unit: GAP_UNITS.illuminance,
      severity: classifyGapSeverity(luxDiff, p.illuminanceTolerance),
      direction: luxDiff > 0 ? 'too_high' : 'too_low',
    });
  }

  const noiseDiff = env.estimatedNoise - p.noisePreferred;
  if (noiseDiff > p.noiseTolerance * 0.5) {
    gaps.push({
      parameter: 'noise',
      labelAr: GAP_LABELS.noise,
      current: env.estimatedNoise,
      preferred: p.noisePreferred,
      unit: GAP_UNITS.noise,
      severity: classifyGapSeverity(noiseDiff, p.noiseTolerance),
      direction: 'too_high',
    });
  }

  const co2Diff = env.estimatedCO2 - 1000;
  if (co2Diff > 0) {
    gaps.push({
      parameter: 'co2',
      labelAr: GAP_LABELS.co2,
      current: env.estimatedCO2,
      preferred: 800,
      unit: GAP_UNITS.co2,
      severity: co2Diff > 200 ? 'critical' : 'high',
      direction: 'too_high',
    });
  }

  // Build interventions based on gaps
  const interventions: Intervention[] = [];

  gaps.forEach(gap => {
    if (gap.parameter === 'temperature' && gap.direction === 'too_high') {
      if (env.nearestExteriorOrientation === 'south' || env.nearestExteriorOrientation === 'west') {
        interventions.push({
          id: `int-glaze-${seat.id}`,
          type: 'glazing',
          titleAr: 'Upgrade hot-facade glazing to Low-E',
          descriptionAr: `The ${env.nearestExteriorOrientation === 'south' ? 'south' : 'west'} facade is creating high solar heat gain. Low-E glazing can reduce heat gain by roughly 55%.`,
          criteria: 'Thermal comfort',
          expectedImprovement: 18,
          priority: gap.severity === 'critical' ? 'critical' : 'high',
        });
        interventions.push({
          id: `int-shade-${seat.id}`,
          type: 'shading',
          titleAr: 'Add exterior shading',
          descriptionAr: 'Exterior shading blocks solar gain before it enters the workspace and is more effective than interior blinds alone.',
          criteria: 'Thermal comfort',
          expectedImprovement: 12,
          priority: 'high',
        });
      } else {
        interventions.push({
          id: `int-relocate-${seat.id}`,
          type: 'relocate',
          titleAr: `Move ${profile.name} away from the hot facade`,
          descriptionAr: `The seat is ${env.distanceToExteriorWall}m from the exterior wall. Moving deeper into the plan should reduce heat exposure.`,
          criteria: 'Thermal comfort',
          expectedImprovement: 15,
          priority: gap.severity === 'critical' ? 'critical' : 'medium',
        });
      }
    }

    if (gap.parameter === 'illuminance' && gap.direction === 'too_low') {
      interventions.push({
        id: `int-light-${seat.id}`,
        type: 'lighting',
        titleAr: 'Add dimmable task lighting',
        descriptionAr: `Current illuminance is ${env.estimatedIlluminance} lux, below the preferred ${p.illuminancePreferred} lux. Add dimmable LED task lighting in the 200-750 lux range.`,
        criteria: 'Lighting comfort',
        expectedImprovement: 14,
        priority: 'medium',
      });
    }

    if (gap.parameter === 'illuminance' && gap.direction === 'too_high') {
      interventions.push({
        id: `int-glare-${seat.id}`,
        type: 'shading',
        titleAr: 'Reduce glare with shading',
        descriptionAr: `Current illuminance is ${env.estimatedIlluminance} lux, above the preferred range. Add a shade or redirecting panel to soften glare.`,
        criteria: 'Glare control',
        expectedImprovement: 10,
        priority: 'medium',
      });
    }

    if (gap.parameter === 'noise') {
      interventions.push({
        id: `int-partition-${seat.id}`,
        type: 'partition',
        titleAr: 'Add acoustic absorption',
        descriptionAr: `Noise level is ${env.estimatedNoise} dB, above the preferred ${p.noisePreferred} dB. A 50mm acoustic panel can reduce noise by 8-12 dB.`,
        criteria: 'Acoustic comfort',
        expectedImprovement: 16,
        priority: gap.severity === 'critical' ? 'critical' : 'high',
      });
    }

    if (gap.parameter === 'co2') {
      interventions.push({
        id: `int-vent-${seat.id}`,
        type: 'ventilation',
        titleAr: 'Increase local ventilation',
        descriptionAr: `CO2 is ${env.estimatedCO2} ppm, above the target threshold. Add a nearby supply path or increase fresh-air exchange.`,
        criteria: 'Air quality',
        expectedImprovement: 20,
        priority: 'critical',
      });
    }
  });

  // Remove duplicate interventions
  const uniqueInterventions = interventions.filter(
    (v, i, a) => a.findIndex(t => t.type === v.type) === i
  );

  return {
    userId: profile.id,
    userName: profile.name,
    userRole: profile.role,
    userAvatar: profile.avatar,
    seatId: seat.id,
    seatLabel: seat.label,
    environment: env,
    comfortMatch,
    gaps,
    interventions: uniqueInterventions,
  };
}

// ─── GENERATION ──────────────────────────────────────────────────────────────

export interface DesignCard {
  zone: string;
  recommendations: DesignRecommendation[];
  affectedEmployees: number;
  totalEmployees: number;
  expectedComfortGain: number;
}

export interface DesignRecommendation {
  id: string;
  category: 'glazing' | 'partition' | 'lighting' | 'ventilation' | 'shading' | 'layout';
  titleAr: string;
  descriptionAr: string;
  criteria: string;
  affectedCount: number;
  priority: 'critical' | 'high' | 'medium';
  technicalSpec: string;
}

export function generateDesignCard(diagnoses: EmployeeDiagnosis[]): DesignCard {
  const total = diagnoses.length;
  if (total === 0) {
    return { zone: '', recommendations: [], affectedEmployees: 0, totalEmployees: 0, expectedComfortGain: 0 };
  }

  // Aggregate gaps across all employees
  const gapCounts: Record<string, { count: number; directions: string[] }> = {};
  const glazingNeeded: string[] = [];

  diagnoses.forEach(d => {
    d.gaps.forEach(g => {
      if (!gapCounts[g.parameter]) gapCounts[g.parameter] = { count: 0, directions: [] };
      gapCounts[g.parameter].count++;
      gapCounts[g.parameter].directions.push(g.direction);
    });
    d.environment.nearestExteriorOrientation && glazingNeeded.push(d.environment.nearestExteriorOrientation);
  });

  const recommendations: DesignRecommendation[] = [];

  // Thermal
  const thermalCount = gapCounts['temperature']?.count ?? 0;
  if (thermalCount > 0) {
    const southCount = glazingNeeded.filter(o => o === 'south').length;
    const westCount = glazingNeeded.filter(o => o === 'west').length;
    if (southCount + westCount >= Math.ceil(total * 0.3)) {
      recommendations.push({
        id: 'rec-glazing',
        category: 'glazing',
        titleAr: 'Upgrade south and west glazing to Low-E',
        descriptionAr: `${thermalCount} of ${total} employees are exposed to high heat. Low-E glazing with U-value <= 1.4 W/m2K can reduce solar heat gain by roughly 55%.`,
        criteria: 'Thermal comfort',
        affectedCount: thermalCount,
        priority: thermalCount >= Math.ceil(total * 0.5) ? 'critical' : 'high',
        technicalSpec: 'Low-E double glazing, U-value <= 1.4 W/m2K, SHGC <= 0.25',
      });
    } else {
      recommendations.push({
        id: 'rec-relocate',
        category: 'layout',
        titleAr: 'Redistribute seats away from hot facades',
        descriptionAr: `Move ${thermalCount} employees farther from exterior walls to reduce heat exposure without construction work.`,
        criteria: 'Thermal comfort',
        affectedCount: thermalCount,
        priority: 'medium',
        technicalSpec: 'Keep heat-sensitive desks at least 2m from south and west exterior walls',
      });
    }
  }

  // Acoustic
  const noiseCount = gapCounts['noise']?.count ?? 0;
  if (noiseCount > 0) {
    recommendations.push({
      id: 'rec-partition',
      category: 'partition',
      titleAr: 'Install acoustic partitions',
      descriptionAr: `${noiseCount} employees are above their preferred noise range. 50mm acoustic panels can reduce noise by 8-12 dB.`,
      criteria: 'Acoustic comfort',
      affectedCount: noiseCount,
      priority: noiseCount >= Math.ceil(total * 0.5) ? 'high' : 'medium',
      technicalSpec: '50mm acoustic panel, 1.4m height, NRC >= 0.75',
    });
  }

  // Lighting
  const lightCount = gapCounts['illuminance']?.count ?? 0;
  if (lightCount > 0) {
    const tooLow = (gapCounts['illuminance']?.directions ?? []).filter(d => d === 'too_low').length;
    const tooHigh = (gapCounts['illuminance']?.directions ?? []).filter(d => d === 'too_high').length;
    if (tooLow > tooHigh) {
      recommendations.push({
        id: 'rec-lighting',
        category: 'lighting',
        titleAr: 'Install dimmable LED task lighting',
        descriptionAr: `${tooLow} employees need higher light levels. Dimmable LED lighting in the 200-750 lux range supports varied preferences.`,
        criteria: 'Lighting comfort',
        affectedCount: lightCount,
        priority: 'medium',
        technicalSpec: '0-100% dimmable LED, 200-750 lux, 3000-5000K color temperature',
      });
    } else {
      recommendations.push({
        id: 'rec-glare',
        category: 'shading',
        titleAr: 'Add glare-control shades',
        descriptionAr: `${tooHigh} employees are exposed to excessive light. Use translucent shades or redirecting panels to soften glare while keeping daylight.`,
        criteria: 'Glare control',
        affectedCount: lightCount,
        priority: 'medium',
        technicalSpec: 'Translucent shades with 30-50% visible light transmission',
      });
    }
  }

  // Ventilation
  const co2Count = gapCounts['co2']?.count ?? 0;
  if (co2Count > 0) {
    recommendations.push({
      id: 'rec-ventilation',
      category: 'ventilation',
      titleAr: 'Increase air exchange',
      descriptionAr: `${co2Count} employees are in high CO2 zones above 1000 ppm. Increase fresh-air delivery near occupied areas.`,
      criteria: 'Air quality',
      affectedCount: co2Count,
      priority: 'critical',
      technicalSpec: 'Fresh-air delivery >= 10 L/s/person near high-occupancy zones',
    });
  }

  const affectedEmployees = diagnoses.filter(d => d.gaps.length > 0).length;
  const avgGain = recommendations.reduce((s, r) => s + r.affectedCount * 15, 0) / Math.max(1, total);

  return {
    zone: ' ',
    recommendations,
    affectedEmployees,
    totalEmployees: total,
    expectedComfortGain: Math.round(Math.min(35, avgGain)),
  };
}

// ─── COMPARISON ──────────────────────────────────────────────────────────────

export interface ComparisonResult {
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  seatLabel: string;
  beforeScore: number;
  afterScore: number;
  improvement: number;
  beforeGaps: number;
  afterGaps: number;
}

export interface ComparisonSummary {
  results: ComparisonResult[];
  avgBefore: number;
  avgAfter: number;
  avgImprovement: number;
  employeesImproved: number;
  totalEmployees: number;
}

export function compareScenarios(
  profiles: UserProfile[],
  seats: Seat[],
  planBefore: FloorPlan,
  planAfter: FloorPlan,
  city: string,
  ledCompensation: boolean = false,
  simulationDate?: Date
): ComparisonSummary {
  const results: ComparisonResult[] = [];

  seats.forEach(seat => {
    const profile = profiles.find(p => p.id === seat.userId);
    if (!profile) return;

    const envBefore = calculateSeatEnvironment(seat, planBefore, city, simulationDate);
    const envAfter = calculateSeatEnvironment(seat, planAfter, city, simulationDate);

    const sensorBefore = {
      temperature: envBefore.estimatedTemperature,
      illuminance: envBefore.estimatedIlluminance,
      noise: envBefore.estimatedNoise,
      co2: envBefore.estimatedCO2,
      humidity: envBefore.estimatedHumidity,
    };
    // LED compensation: when low-e/triple glazing is used, supplement with tunable LED
    // to bring illuminance back to the preferred range (realistic design practice)
    const compensatedIlluminance = ledCompensation
      ? Math.min(envAfter.estimatedIlluminance + 180, profile.preferences.illuminancePreferred + 50)
      : envAfter.estimatedIlluminance;

    const sensorAfter = {
      temperature: envAfter.estimatedTemperature,
      illuminance: compensatedIlluminance,
      noise: envAfter.estimatedNoise,
      co2: envAfter.estimatedCO2,
      humidity: envAfter.estimatedHumidity,
    };

    const matchBefore = calculateComfortMatch(profile, sensorBefore);
    const matchAfter = calculateComfortMatch(profile, sensorAfter);

    const diagBefore = diagnoseEmployee(profile, seat, envBefore);
    const diagAfter = diagnoseEmployee(profile, seat, envAfter);

    results.push({
      employeeId: profile.id,
      employeeName: profile.name,
      employeeAvatar: profile.avatar,
      seatLabel: seat.label,
      beforeScore: matchBefore.overall,
      afterScore: matchAfter.overall,
      improvement: matchAfter.overall - matchBefore.overall,
      beforeGaps: diagBefore.gaps.length,
      afterGaps: diagAfter.gaps.length,
    });
  });

  const n = results.length;
  if (n === 0) return { results: [], avgBefore: 0, avgAfter: 0, avgImprovement: 0, employeesImproved: 0, totalEmployees: 0 };

  const avgBefore = Math.round(results.reduce((s, r) => s + r.beforeScore, 0) / n);
  const avgAfter = Math.round(results.reduce((s, r) => s + r.afterScore, 0) / n);

  return {
    results,
    avgBefore,
    avgAfter,
    avgImprovement: avgAfter - avgBefore,
    employeesImproved: results.filter(r => r.improvement > 0).length,
    totalEmployees: n,
  };
}
