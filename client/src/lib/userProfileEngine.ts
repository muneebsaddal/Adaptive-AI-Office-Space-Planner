/**
 * User Profile Engine — comfort Adaptive Space Planning
 * =====================================================
 * Design Philosophy: Scandinavian Comfort Dashboard
 * Purpose: Manages user profiles with personal environmental preferences
 * aligned with comfort standards. Each user has a unique environmental
 * fingerprint that drives personalized space recommendations.
 */

// ─── comfort Environmental Preference Ranges ───────────────────────────────

export const comfort_RANGES = {
  temperature: { min: 18, max: 28, comfortMin: 20, comfortMax: 26, unit: '°C' },
  illuminance: { min: 100, max: 1000, comfortMin: 300, comfortMax: 750, unit: 'lux' },
  noise: { min: 25, max: 70, comfortMin: 30, comfortMax: 50, unit: 'dB' },
  co2: { min: 400, max: 1500, comfortMin: 400, comfortMax: 1000, unit: 'ppm' },
  humidity: { min: 20, max: 80, comfortMin: 30, comfortMax: 60, unit: '%' },
  airflow: { min: 0, max: 10, comfortMin: 0.1, comfortMax: 0.8, unit: 'm/s' },
};

// ─── User Activity Types ────────────────────────────────────────────────────

export type ActivityType =
  | 'deep_focus'      // Deep focus
  | 'collaborative'   // 
  | 'creative'        // 
  | 'administrative'  // 
  | 'meeting'         // Meetings
  | 'learning';       // 

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  deep_focus: 'Deep focus',
  collaborative: 'Collaborative work',
  creative: 'Creative work',
  administrative: 'Administrative work',
  meeting: 'Meetings',
  learning: 'Learning and development',
};

// ─── Sensitivity Levels ─────────────────────────────────────────────────────

export type SensitivityLevel = 'low' | 'medium' | 'high';

export const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// ─── Health Conditions affecting comfort preferences ───────────────────────────

export type HealthCondition =
  | 'none'
  | 'asthma'          //  —  Air 
  | 'migraine'        // Migraine —  Light  
  | 'back_pain'       //   —   
  | 'eye_strain'      // Eye strain —  Light 
  | 'heat_sensitive'  // Heat sensitivity
  | 'cold_sensitive'; // Cold sensitivity

export const HEALTH_LABELS: Record<HealthCondition, string> = {
  none: 'None',
  asthma: 'Asthma / respiratory sensitivity',
  migraine: 'Migraine',
  back_pain: 'Back pain',
  eye_strain: 'Eye strain',
  heat_sensitive: 'Heat sensitivity',
  cold_sensitive: 'Cold sensitivity',
};

// ─── Work Style ─────────────────────────────────────────────────────────────

export type WorkStyle = 'introvert' | 'extrovert' | 'ambivert';

export const WORK_STYLE_LABELS: Record<WorkStyle, string> = {
  introvert: 'Introvert - prefers solo work',
  extrovert: 'Extrovert - prefers social interaction',
  ambivert: 'Ambivert - adapts to both modes',
};

// ─── Environmental Preferences ──────────────────────────────────────────────

export interface EnvironmentalPreferences {
  // Temperature 
  temperaturePreferred: number;       // 18–28°C
  temperatureTolerance: number;       // ± 

  // Light 
  illuminancePreferred: number;       // 100–1000 lux
  illuminanceTolerance: number;       // ±lux 
  naturalLightPreference: 'high' | 'medium' | 'low'; //   

  // Noise
  noisePreferred: number;             // 25–70 dB
  noiseTolerance: number;             // ±dB 
  noiseSensitivity: SensitivityLevel;

  //  Air
  co2Sensitivity: SensitivityLevel;
  ventilationPreference: 'high' | 'medium' | 'low';

  // Humidity
  humidityPreferred: number;          // 30–60%
  humidityTolerance: number;

  //  
  movementFrequency: 'frequent' | 'moderate' | 'rare'; //  
  standingDeskPreference: boolean;
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  role: string;                        // Role
  department: string;                  // Department
  avatar: string;                      //   (emoji)
  workStyle: WorkStyle;
  primaryActivity: ActivityType;
  secondaryActivities: ActivityType[];
  healthConditions: HealthCondition[];
  preferences: EnvironmentalPreferences;
  comfortScore: number;               //    (0–100)
  createdAt: Date;
  lastUpdated: Date;
  preferredZones: string[];            //  
  notes: string;                       // Notes
}

// ─── Default Preferences by Activity Type ───────────────────────────────────

export const DEFAULT_PREFERENCES_BY_ACTIVITY: Record<ActivityType, Partial<EnvironmentalPreferences>> = {
  deep_focus: {
    temperaturePreferred: 21,
    temperatureTolerance: 1.5,
    illuminancePreferred: 500,
    illuminanceTolerance: 100,
    naturalLightPreference: 'medium',
    noisePreferred: 35,
    noiseTolerance: 5,
    noiseSensitivity: 'high',
    co2Sensitivity: 'high',
    ventilationPreference: 'high',
    humidityPreferred: 45,
    humidityTolerance: 10,
    movementFrequency: 'moderate',
    standingDeskPreference: false,
  },
  collaborative: {
    temperaturePreferred: 22,
    temperatureTolerance: 2,
    illuminancePreferred: 450,
    illuminanceTolerance: 150,
    naturalLightPreference: 'high',
    noisePreferred: 50,
    noiseTolerance: 10,
    noiseSensitivity: 'low',
    co2Sensitivity: 'medium',
    ventilationPreference: 'high',
    humidityPreferred: 45,
    humidityTolerance: 15,
    movementFrequency: 'frequent',
    standingDeskPreference: true,
  },
  creative: {
    temperaturePreferred: 22,
    temperatureTolerance: 2,
    illuminancePreferred: 400,
    illuminanceTolerance: 200,
    naturalLightPreference: 'high',
    noisePreferred: 45,
    noiseTolerance: 10,
    noiseSensitivity: 'medium',
    co2Sensitivity: 'medium',
    ventilationPreference: 'medium',
    humidityPreferred: 50,
    humidityTolerance: 15,
    movementFrequency: 'frequent',
    standingDeskPreference: true,
  },
  administrative: {
    temperaturePreferred: 22,
    temperatureTolerance: 2,
    illuminancePreferred: 400,
    illuminanceTolerance: 100,
    naturalLightPreference: 'medium',
    noisePreferred: 40,
    noiseTolerance: 8,
    noiseSensitivity: 'medium',
    co2Sensitivity: 'low',
    ventilationPreference: 'medium',
    humidityPreferred: 45,
    humidityTolerance: 15,
    movementFrequency: 'moderate',
    standingDeskPreference: false,
  },
  meeting: {
    temperaturePreferred: 22,
    temperatureTolerance: 2,
    illuminancePreferred: 400,
    illuminanceTolerance: 150,
    naturalLightPreference: 'medium',
    noisePreferred: 55,
    noiseTolerance: 10,
    noiseSensitivity: 'low',
    co2Sensitivity: 'high',
    ventilationPreference: 'high',
    humidityPreferred: 45,
    humidityTolerance: 15,
    movementFrequency: 'moderate',
    standingDeskPreference: false,
  },
  learning: {
    temperaturePreferred: 21,
    temperatureTolerance: 1.5,
    illuminancePreferred: 500,
    illuminanceTolerance: 100,
    naturalLightPreference: 'high',
    noisePreferred: 38,
    noiseTolerance: 7,
    noiseSensitivity: 'high',
    co2Sensitivity: 'high',
    ventilationPreference: 'high',
    humidityPreferred: 45,
    humidityTolerance: 10,
    movementFrequency: 'moderate',
    standingDeskPreference: false,
  },
};

// ─── Health Condition Adjustments ───────────────────────────────────────────

export function applyHealthAdjustments(
  prefs: EnvironmentalPreferences,
  conditions: HealthCondition[]
): EnvironmentalPreferences {
  const adjusted = { ...prefs };

  conditions.forEach(condition => {
    switch (condition) {
      case 'asthma':
        adjusted.co2Sensitivity = 'high';
        adjusted.ventilationPreference = 'high';
        break;
      case 'migraine':
        adjusted.illuminancePreferred = Math.min(adjusted.illuminancePreferred, 350);
        adjusted.noiseSensitivity = 'high';
        adjusted.noisePreferred = Math.min(adjusted.noisePreferred, 38);
        break;
      case 'back_pain':
        adjusted.movementFrequency = 'frequent';
        adjusted.standingDeskPreference = true;
        break;
      case 'eye_strain':
        adjusted.illuminancePreferred = Math.min(adjusted.illuminancePreferred, 400);
        adjusted.naturalLightPreference = 'medium';
        break;
      case 'heat_sensitive':
        adjusted.temperaturePreferred = Math.min(adjusted.temperaturePreferred, 21);
        adjusted.temperatureTolerance = Math.min(adjusted.temperatureTolerance, 1.5);
        break;
      case 'cold_sensitive':
        adjusted.temperaturePreferred = Math.max(adjusted.temperaturePreferred, 23);
        adjusted.temperatureTolerance = Math.min(adjusted.temperatureTolerance, 1.5);
        break;
    }
  });

  return adjusted;
}

// ─── Personal Comfort Score Calculator ─────────────────────────────────────

export interface ComfortMatch {
  overall: number;           // 0–100
  temperature: number;
  illuminance: number;
  noise: number;
  airQuality: number;
  humidity: number;
  details: string[];         //  
  mismatches: string[];      //   
}

export function calculateComfortMatch(
  profile: UserProfile,
  sensorData: {
    temperature: number;
    illuminance: number;
    noise: number;
    co2: number;
    humidity: number;
  }
): ComfortMatch {
  const p = profile.preferences;
  const details: string[] = [];
  const mismatches: string[] = [];

  // Temperature match
  const tempDiff = Math.abs(sensorData.temperature - p.temperaturePreferred);
  const tempScore = Math.max(0, 100 - (tempDiff / p.temperatureTolerance) * 50);
  if (tempScore >= 80) details.push(`Temperature  (${sensorData.temperature}°C)`);
  else mismatches.push(`Temperature ${sensorData.temperature}°C    ${p.temperaturePreferred}°C`);

  // Illuminance match
  const luxDiff = Math.abs(sensorData.illuminance - p.illuminancePreferred);
  const luxScore = Math.max(0, 100 - (luxDiff / p.illuminanceTolerance) * 50);
  if (luxScore >= 80) details.push(`Illuminance  (${sensorData.illuminance} lux)`);
  else mismatches.push(`Light ${sensorData.illuminance} lux    ${p.illuminancePreferred} lux`);

  // Noise match
  const noiseDiff = Math.abs(sensorData.noise - p.noisePreferred);
  const noiseSensMultiplier = p.noiseSensitivity === 'high' ? 2 : p.noiseSensitivity === 'medium' ? 1.5 : 1;
  const noiseScore = Math.max(0, 100 - (noiseDiff / p.noiseTolerance) * 50 * noiseSensMultiplier);
  if (noiseScore >= 80) details.push(`Noise level  (${sensorData.noise} dB)`);
  else mismatches.push(`Noise ${sensorData.noise} dB ${sensorData.noise > p.noisePreferred ? '' : ''}  `);

  // Air quality match
  const co2SensMultiplier = p.co2Sensitivity === 'high' ? 1.5 : p.co2Sensitivity === 'medium' ? 1.2 : 1;
  const co2Score = sensorData.co2 <= 1000
    ? Math.max(0, 100 - ((sensorData.co2 - 400) / 600) * 30 * co2SensMultiplier)
    : Math.max(0, 100 - ((sensorData.co2 - 1000) / 500) * 80 * co2SensMultiplier);
  if (co2Score >= 80) details.push(` Air  (CO₂: ${sensorData.co2} ppm)`);
  else mismatches.push(` CO₂ High (${sensorData.co2} ppm) —  ${SENSITIVITY_LABELS[p.co2Sensitivity]}`);

  // Humidity match
  const humidDiff = Math.abs(sensorData.humidity - p.humidityPreferred);
  const humidScore = Math.max(0, 100 - (humidDiff / p.humidityTolerance) * 50);
  if (humidScore >= 80) details.push(`Humidity  (${sensorData.humidity}%)`);
  else mismatches.push(`Humidity ${sensorData.humidity}%    ${p.humidityPreferred}%`);

  const overall = Math.round(
    (tempScore * 0.25 + luxScore * 0.20 + noiseScore * 0.25 + co2Score * 0.20 + humidScore * 0.10)
  );

  return {
    overall,
    temperature: Math.round(tempScore),
    illuminance: Math.round(luxScore),
    noise: Math.round(noiseScore),
    airQuality: Math.round(co2Score),
    humidity: Math.round(humidScore),
    details,
    mismatches,
  };
}

// ─── Personalized Recommendations ───────────────────────────────────────────

export interface PersonalRecommendation {
  id: string;
  userId: string;
  userName: string;
  type: 'zone_change' | 'environment_adjust' | 'break' | 'health_alert' | 'optimal';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  category: string;
  matchScore: number;
}

export function generatePersonalRecommendations(
  profile: UserProfile,
  currentZone: string,
  match: ComfortMatch,
  allZonesData: Array<{ id: string; name: string; sensorData: any }>
): PersonalRecommendation[] {
  const recommendations: PersonalRecommendation[] = [];
  const p = profile.preferences;

  //   Current environment 
  if (match.overall >= 85) {
    recommendations.push({
      id: `opt-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'optimal',
      priority: 'low',
      title: 'Current environment  ',
      description: `   ${match.overall}%     comfort`,
      action: '   —    ',
      category: 'Mind & Comfort',
      matchScore: match.overall,
    });
    return recommendations;
  }

  // recommendations   —   
  const betterZone = allZonesData
    .filter(z => z.id !== currentZone)
    .map(z => ({
      ...z,
      match: calculateComfortMatch(profile, z.sensorData),
    }))
    .sort((a, b) => b.match.overall - a.match.overall)[0];

  if (betterZone && betterZone.match.overall > match.overall + 10) {
    recommendations.push({
      id: `zone-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'zone_change',
      priority: betterZone.match.overall - match.overall > 25 ? 'high' : 'medium',
      title: `  ${betterZone.name}`,
      description: `${betterZone.name}  ${betterZone.match.overall}%     ${match.overall}%   `,
      action: `   ${betterZone.name}      ${betterZone.match.overall - match.overall}%`,
      category: 'Mind & Comfort',
      matchScore: betterZone.match.overall,
    });
  }

  //   
  if (match.temperature < 70) {
    const isHot = p.temperaturePreferred < 22;
    recommendations.push({
      id: `temp-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'environment_adjust',
      priority: match.temperature < 50 ? 'high' : 'medium',
      title: ` Temperature`,
      description: ` ${p.temperaturePreferred}°C — Temperature   `,
      action: isHot
        ? `    ${p.temperaturePreferred}°C    `
        : `  Temperature  ${p.temperaturePreferred}°C    `,
      category: 'Thermal Comfort',
      matchScore: match.temperature,
    });
  }

  if (match.noise < 70) {
    recommendations.push({
      id: `noise-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'environment_adjust',
      priority: p.noiseSensitivity === 'high' && match.noise < 50 ? 'high' : 'medium',
      title: `Noise level Affects `,
      description: ` Noise ${SENSITIVITY_LABELS[p.noiseSensitivity]} —     `,
      action: p.noiseSensitivity === 'high'
        ? '        '
        : '       ',
      category: 'Sound',
      matchScore: match.noise,
    });
  }

  if (match.illuminance < 70) {
    recommendations.push({
      id: `light-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'environment_adjust',
      priority: 'medium',
      title: `Light   `,
      description: ` ${p.illuminancePreferred} lux  "${ACTIVITY_LABELS[profile.primaryActivity]}"`,
      action: p.illuminancePreferred > 400
        ? '  Illuminance    Light  '
        : '  Light      Temperature  ',
      category: 'Light',
      matchScore: match.illuminance,
    });
  }

  if (match.airQuality < 70) {
    recommendations.push({
      id: `air-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: profile.healthConditions.includes('asthma') ? 'health_alert' : 'environment_adjust',
      priority: profile.healthConditions.includes('asthma') ? 'critical' : 'high',
      title: profile.healthConditions.includes('asthma')
        ? ' :  Air   '
        : ' Air   ',
      description: `  Air ${SENSITIVITY_LABELS[p.co2Sensitivity]}`,
      action: '        Ventilation',
      category: 'Air',
      matchScore: match.airQuality,
    });
  }

  // recommendations 
  if (p.movementFrequency === 'frequent') {
    recommendations.push({
      id: `move-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'break',
      priority: 'low',
      title: ' ',
      description: '         45 ',
      action: p.standingDeskPreference
        ? '         '
        : '  5   ',
      category: 'Movement',
      matchScore: 100,
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ─── Sample Profiles ─────────────────────────────────────────────────────────

export function createSampleProfiles(): UserProfile[] {
  return [
    {
      id: 'user-001',
      name: 'Sarah Ahmed',
      role: 'Graphic Designer',
      department: 'Creative Design',
      avatar: '👩‍🎨',
      workStyle: 'introvert',
      primaryActivity: 'creative',
      secondaryActivities: ['deep_focus', 'learning'],
      healthConditions: ['eye_strain', 'migraine'],
      preferences: applyHealthAdjustments(
        {
          ...DEFAULT_PREFERENCES_BY_ACTIVITY.creative,
          temperaturePreferred: 22,
          temperatureTolerance: 2,
          illuminancePreferred: 350,
          illuminanceTolerance: 100,
          naturalLightPreference: 'high',
          noisePreferred: 38,
          noiseTolerance: 7,
          noiseSensitivity: 'high',
          co2Sensitivity: 'medium',
          ventilationPreference: 'medium',
          humidityPreferred: 50,
          humidityTolerance: 15,
          movementFrequency: 'frequent',
          standingDeskPreference: true,
        } as EnvironmentalPreferences,
        ['eye_strain', 'migraine']
      ),
      comfortScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-1', 'zone-6'],
      notes: 'Needs steady lighting for financial review work',
    },
    {
      id: 'user-002',
      name: 'Mohammed Omari',
      role: 'Project Manager',
      department: 'Project Management',
      avatar: '👨‍💼',
      workStyle: 'extrovert',
      primaryActivity: 'meeting',
      secondaryActivities: ['collaborative', 'administrative'],
      healthConditions: ['none'],
      preferences: {
        ...DEFAULT_PREFERENCES_BY_ACTIVITY.meeting,
        temperaturePreferred: 22,
        temperatureTolerance: 2.5,
        illuminancePreferred: 450,
        illuminanceTolerance: 150,
        naturalLightPreference: 'medium',
        noisePreferred: 52,
        noiseTolerance: 12,
        noiseSensitivity: 'low',
        co2Sensitivity: 'medium',
        ventilationPreference: 'high',
        humidityPreferred: 45,
        humidityTolerance: 15,
        movementFrequency: 'frequent',
        standingDeskPreference: false,
      } as EnvironmentalPreferences,
      comfortScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-2', 'zone-3'],
      notes: 'Uses nearby collaboration spaces for frequent meetings',
    },
    {
      id: 'user-003',
      name: 'Noura Salem',
      role: 'Data Analyst',
      department: 'Information Technology',
      avatar: '👩‍💻',
      workStyle: 'introvert',
      primaryActivity: 'deep_focus',
      secondaryActivities: ['learning', 'administrative'],
      healthConditions: ['asthma', 'back_pain'],
      preferences: applyHealthAdjustments(
        {
          ...DEFAULT_PREFERENCES_BY_ACTIVITY.deep_focus,
          temperaturePreferred: 21,
          temperatureTolerance: 1.5,
          illuminancePreferred: 500,
          illuminanceTolerance: 80,
          naturalLightPreference: 'medium',
          noisePreferred: 33,
          noiseTolerance: 5,
          noiseSensitivity: 'high',
          co2Sensitivity: 'high',
          ventilationPreference: 'high',
          humidityPreferred: 45,
          humidityTolerance: 10,
          movementFrequency: 'frequent',
          standingDeskPreference: true,
        } as EnvironmentalPreferences,
        ['asthma', 'back_pain']
      ),
      comfortScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-1'],
      notes: 'Needs clean air and ergonomic support for back pain',
    },
    {
      id: 'user-004',
      name: 'Khalid Zahrani',
      role: 'Architect',
      department: 'Design and Engineering',
      avatar: '👨‍🏗️',
      workStyle: 'ambivert',
      primaryActivity: 'creative',
      secondaryActivities: ['collaborative', 'meeting'],
      healthConditions: ['none'],
      preferences: {
        ...DEFAULT_PREFERENCES_BY_ACTIVITY.creative,
        temperaturePreferred: 23,
        temperatureTolerance: 2,
        illuminancePreferred: 600,
        illuminanceTolerance: 150,
        naturalLightPreference: 'high',
        noisePreferred: 45,
        noiseTolerance: 10,
        noiseSensitivity: 'medium',
        co2Sensitivity: 'low',
        ventilationPreference: 'medium',
        humidityPreferred: 45,
        humidityTolerance: 15,
        movementFrequency: 'frequent',
        standingDeskPreference: true,
      } as EnvironmentalPreferences,
      comfortScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-6', 'zone-2'],
      notes: 'Needs high light levels for plans and physical models',
    },
    {
      id: 'user-005',
      name: 'Reem Harbi',
      role: 'HR Specialist',
      department: 'Human Resources',
      avatar: '👩‍💼',
      workStyle: 'extrovert',
      primaryActivity: 'administrative',
      secondaryActivities: ['meeting', 'collaborative'],
      healthConditions: ['cold_sensitive'],
      preferences: applyHealthAdjustments(
        {
          ...DEFAULT_PREFERENCES_BY_ACTIVITY.administrative,
          temperaturePreferred: 23,
          temperatureTolerance: 1.5,
          illuminancePreferred: 400,
          illuminanceTolerance: 100,
          naturalLightPreference: 'medium',
          noisePreferred: 42,
          noiseTolerance: 8,
          noiseSensitivity: 'medium',
          co2Sensitivity: 'low',
          ventilationPreference: 'medium',
          humidityPreferred: 50,
          humidityTolerance: 15,
          movementFrequency: 'moderate',
          standingDeskPreference: false,
        } as EnvironmentalPreferences,
        ['cold_sensitive']
      ),
      comfortScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-3', 'zone-4'],
      notes: 'Prefers a warm setting and privacy for interviews',
    },
  ];
}

// ─── Local Storage Persistence ──────────────────────────────────────────────

const STORAGE_KEY = 'comfort_user_profiles';

export function saveProfiles(profiles: UserProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.warn('Failed to save profiles to localStorage');
  }
}

export function loadProfiles(): UserProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const profiles = JSON.parse(stored).map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        lastUpdated: new Date(p.lastUpdated),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      return profiles;
    }
  } catch (e) {
    console.warn('Failed to load profiles from localStorage');
  }
  return createSampleProfiles();
}
