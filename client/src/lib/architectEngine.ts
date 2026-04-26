/**
 * Architect Engine — WELL v2 Adaptive Space Planning
 * ===================================================
 * Three tools for the architect:
 * 1. DIAGNOSIS   — gap between each employee's preferences and their seat environment
 * 2. GENERATION  — design recommendations card based on all employees
 * 3. COMPARISON  — before/after wellness scores when design changes
 */

import { UserProfile, calculateWellnessMatch, WellnessMatch } from './userProfileEngine';
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
  wellnessMatch: WellnessMatch;
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
  wellCriteria: string;
  expectedImprovement: number; // % wellness score improvement
  priority: 'critical' | 'high' | 'medium';
}

const GAP_LABELS: Record<string, string> = {
  temperature: 'درجة الحرارة',
  illuminance: 'مستوى الإضاءة',
  noise: 'مستوى الضوضاء',
  co2: 'جودة الهواء (CO₂)',
  humidity: 'الرطوبة',
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

  const wellnessMatch = calculateWellnessMatch(profile, sensorData);

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
          titleAr: 'استبدال الزجاج بـ Low-E مزدوج',
          descriptionAr: `الواجهة ${env.nearestExteriorOrientation === 'south' ? 'الجنوبية' : 'الغربية'} تسبب كسباً حرارياً مرتفعاً. زجاج Low-E يُخفّض الكسب الحراري بنسبة 55%.`,
          wellCriteria: 'WELL v2 — Thermal Comfort T01',
          expectedImprovement: 18,
          priority: gap.severity === 'critical' ? 'critical' : 'high',
        });
        interventions.push({
          id: `int-shade-${seat.id}`,
          type: 'shading',
          titleAr: 'إضافة نظام تظليل خارجي أو ستائر ذكية',
          descriptionAr: 'التظليل الخارجي يُقلّل الكسب الحراري قبل دخوله المبنى بكفاءة أعلى من الستائر الداخلية.',
          wellCriteria: 'WELL v2 — Thermal Comfort T02',
          expectedImprovement: 12,
          priority: 'high',
        });
      } else {
        interventions.push({
          id: `int-relocate-${seat.id}`,
          type: 'relocate',
          titleAr: `نقل مقعد ${profile.name} بعيداً عن الواجهة`,
          descriptionAr: `المقعد على بُعد ${env.distanceToExteriorWall}م من الجدار الخارجي. النقل إلى عمق أكبر يُخفّض درجة الحرارة المحيطة.`,
          wellCriteria: 'WELL v2 — Thermal Comfort T01',
          expectedImprovement: 15,
          priority: gap.severity === 'critical' ? 'critical' : 'medium',
        });
      }
    }

    if (gap.parameter === 'illuminance' && gap.direction === 'too_low') {
      interventions.push({
        id: `int-light-${seat.id}`,
        type: 'lighting',
        titleAr: 'إضافة إضاءة مهمة قابلة للتعتيم',
        descriptionAr: `مستوى الإضاءة الحالي ${env.estimatedIlluminance} lux أقل من المفضّل ${p.illuminancePreferred} lux. LED قابل للتعتيم 200–750 lux.`,
        wellCriteria: 'WELL v2 — Light L01',
        expectedImprovement: 14,
        priority: 'medium',
      });
    }

    if (gap.parameter === 'illuminance' && gap.direction === 'too_high') {
      interventions.push({
        id: `int-glare-${seat.id}`,
        type: 'shading',
        titleAr: 'إضافة لوح تظليل لتقليل الوهج',
        descriptionAr: `الإضاءة ${env.estimatedIlluminance} lux أعلى من المفضّل. ستارة شفافة أو لوح انعكاسي يُخفّض الوهج.`,
        wellCriteria: 'WELL v2 — Light L02 (Glare Control)',
        expectedImprovement: 10,
        priority: 'medium',
      });
    }

    if (gap.parameter === 'noise') {
      interventions.push({
        id: `int-partition-${seat.id}`,
        type: 'partition',
        titleAr: 'إضافة حاجز صوتي ممتص',
        descriptionAr: `مستوى الضوضاء ${env.estimatedNoise} dB يتجاوز المقبول ${p.noisePreferred} dB. لوح Rockwool 50mm يُخفّض الضوضاء 8–12 dB.`,
        wellCriteria: 'WELL v2 — Sound S01',
        expectedImprovement: 16,
        priority: gap.severity === 'critical' ? 'critical' : 'high',
      });
    }

    if (gap.parameter === 'co2') {
      interventions.push({
        id: `int-vent-${seat.id}`,
        type: 'ventilation',
        titleAr: 'إضافة فتحة تهوية مباشرة',
        descriptionAr: `CO₂ ${env.estimatedCO2} ppm يتجاوز حد WELL (1000 ppm). فتحة تهوية قريبة تُخفّض التركيز بشكل فعّال.`,
        wellCriteria: 'WELL v2 — Air A01',
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
    wellnessMatch,
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
  expectedWellnessGain: number;
}

export interface DesignRecommendation {
  id: string;
  category: 'glazing' | 'partition' | 'lighting' | 'ventilation' | 'shading' | 'layout';
  titleAr: string;
  descriptionAr: string;
  wellCriteria: string;
  affectedCount: number;
  priority: 'critical' | 'high' | 'medium';
  technicalSpec: string;
}

export function generateDesignCard(diagnoses: EmployeeDiagnosis[]): DesignCard {
  const total = diagnoses.length;
  if (total === 0) {
    return { zone: 'المكتب', recommendations: [], affectedEmployees: 0, totalEmployees: 0, expectedWellnessGain: 0 };
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
        titleAr: 'استبدال الزجاج بـ Low-E مزدوج على الواجهات الجنوبية والغربية',
        descriptionAr: `${thermalCount} من ${total} موظف يعانون من حرارة مرتفعة. زجاج Low-E (U-value ≤ 1.4 W/m²K) يُخفّض الكسب الحراري 55%.`,
        wellCriteria: 'WELL v2 — Thermal Comfort T01 & T02',
        affectedCount: thermalCount,
        priority: thermalCount >= Math.ceil(total * 0.5) ? 'critical' : 'high',
        technicalSpec: 'زجاج Low-E مزدوج، U-value ≤ 1.4 W/m²K، SHGC ≤ 0.25',
      });
    } else {
      recommendations.push({
        id: 'rec-relocate',
        category: 'layout',
        titleAr: 'إعادة توزيع المقاعد بعيداً عن الواجهات الحارة',
        descriptionAr: `نقل ${thermalCount} موظف إلى عمق أكبر من الجدار الخارجي يُقلّل الكسب الحراري دون تكلفة إنشائية.`,
        wellCriteria: 'WELL v2 — Thermal Comfort T01',
        affectedCount: thermalCount,
        priority: 'medium',
        technicalSpec: 'مسافة لا تقل عن 2م من الجدار الخارجي للواجهات الجنوبية والغربية',
      });
    }
  }

  // Acoustic
  const noiseCount = gapCounts['noise']?.count ?? 0;
  if (noiseCount > 0) {
    recommendations.push({
      id: 'rec-partition',
      category: 'partition',
      titleAr: 'تركيب حواجز صوتية ممتصة',
      descriptionAr: `${noiseCount} موظف يعانون من ضوضاء تتجاوز مستوى راحتهم. لوح Rockwool 50mm بين المقاعد يُخفّض الضوضاء 8–12 dB.`,
      wellCriteria: 'WELL v2 — Sound S01 (Maximum Noise Levels)',
      affectedCount: noiseCount,
      priority: noiseCount >= Math.ceil(total * 0.5) ? 'high' : 'medium',
      technicalSpec: 'لوح صوتي Rockwool 50mm، ارتفاع 1.4م، معامل امتصاص NRC ≥ 0.75',
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
        titleAr: 'تركيب إضاءة LED قابلة للتعتيم',
        descriptionAr: `${tooLow} موظف يحتاجون إضاءة أعلى. نظام LED قابل للتعتيم 200–750 lux يُلبّي تفضيلات متباينة.`,
        wellCriteria: 'WELL v2 — Light L01 (Light Exposure and Education)',
        affectedCount: lightCount,
        priority: 'medium',
        technicalSpec: 'LED قابل للتعتيم 0–100%، نطاق 200–750 lux، درجة لون 3000–5000K',
      });
    } else {
      recommendations.push({
        id: 'rec-glare',
        category: 'shading',
        titleAr: 'إضافة ستائر شفافة أو ألواح انعكاسية للتحكم بالوهج',
        descriptionAr: `${tooHigh} موظف يعانون من إضاءة مرتفعة. ستارة شفافة أو لوح انعكاسي يُخفّض الوهج مع الحفاظ على الضوء الطبيعي.`,
        wellCriteria: 'WELL v2 — Light L02 (Glare Control)',
        affectedCount: lightCount,
        priority: 'medium',
        technicalSpec: 'ستائر شفافة بعامل انتقال ضوئي 30–50%، أو لوح انعكاسي أفقي',
      });
    }
  }

  // Ventilation
  const co2Count = gapCounts['co2']?.count ?? 0;
  if (co2Count > 0) {
    recommendations.push({
      id: 'rec-ventilation',
      category: 'ventilation',
      titleAr: 'زيادة معدل تبادل الهواء وإضافة فتحات تهوية',
      descriptionAr: `${co2Count} موظف في مناطق CO₂ مرتفع (>1000 ppm). معدل تبادل هواء 10 L/s/شخص يُعيد التركيز للمستوى الآمن.`,
      wellCriteria: 'WELL v2 — Air A01 (Ventilation Design)',
      affectedCount: co2Count,
      priority: 'critical',
      technicalSpec: 'معدل تبادل هواء ≥ 10 L/s/شخص، فتحات تهوية قريبة من مناطق الإشغال العالي',
    });
  }

  const affectedEmployees = diagnoses.filter(d => d.gaps.length > 0).length;
  const avgGain = recommendations.reduce((s, r) => s + r.affectedCount * 15, 0) / Math.max(1, total);

  return {
    zone: 'المكتب الكامل',
    recommendations,
    affectedEmployees,
    totalEmployees: total,
    expectedWellnessGain: Math.round(Math.min(35, avgGain)),
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

    const matchBefore = calculateWellnessMatch(profile, sensorBefore);
    const matchAfter = calculateWellnessMatch(profile, sensorAfter);

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
