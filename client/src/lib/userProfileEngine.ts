/**
 * User Profile Engine — WELL v2 Adaptive Space Planning
 * =====================================================
 * Design Philosophy: Scandinavian Wellness Dashboard
 * Purpose: Manages user profiles with personal environmental preferences
 * aligned with WELL v2 standards. Each user has a unique environmental
 * fingerprint that drives personalized space recommendations.
 */

// ─── WELL v2 Environmental Preference Ranges ───────────────────────────────

export const WELL_RANGES = {
  temperature: { min: 18, max: 28, wellMin: 20, wellMax: 26, unit: '°C' },
  illuminance: { min: 100, max: 1000, wellMin: 300, wellMax: 750, unit: 'lux' },
  noise: { min: 25, max: 70, wellMin: 30, wellMax: 50, unit: 'dB' },
  co2: { min: 400, max: 1500, wellMin: 400, wellMax: 1000, unit: 'ppm' },
  humidity: { min: 20, max: 80, wellMin: 30, wellMax: 60, unit: '%' },
  airflow: { min: 0, max: 10, wellMin: 0.1, wellMax: 0.8, unit: 'm/s' },
};

// ─── User Activity Types ────────────────────────────────────────────────────

export type ActivityType =
  | 'deep_focus'      // تركيز عميق
  | 'collaborative'   // تعاوني
  | 'creative'        // إبداعي
  | 'administrative'  // إداري
  | 'meeting'         // اجتماعات
  | 'learning';       // تعلّم

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  deep_focus: 'تركيز عميق',
  collaborative: 'عمل تعاوني',
  creative: 'عمل إبداعي',
  administrative: 'أعمال إدارية',
  meeting: 'اجتماعات',
  learning: 'تعلّم وتطوير',
};

// ─── Sensitivity Levels ─────────────────────────────────────────────────────

export type SensitivityLevel = 'low' | 'medium' | 'high';

export const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
};

// ─── Health Conditions affecting WELL preferences ───────────────────────────

export type HealthCondition =
  | 'none'
  | 'asthma'          // ربو — يحتاج هواء أنقى
  | 'migraine'        // صداع نصفي — يحتاج إضاءة أخف وهدوء
  | 'back_pain'       // آلام ظهر — يحتاج حركة أكثر
  | 'eye_strain'      // إجهاد بصري — يحتاج إضاءة مناسبة
  | 'heat_sensitive'  // حساسية للحرارة
  | 'cold_sensitive'; // حساسية للبرودة

export const HEALTH_LABELS: Record<HealthCondition, string> = {
  none: 'لا يوجد',
  asthma: 'ربو / حساسية تنفسية',
  migraine: 'صداع نصفي',
  back_pain: 'آلام الظهر',
  eye_strain: 'إجهاد بصري',
  heat_sensitive: 'حساسية للحرارة',
  cold_sensitive: 'حساسية للبرودة',
};

// ─── Work Style ─────────────────────────────────────────────────────────────

export type WorkStyle = 'introvert' | 'extrovert' | 'ambivert';

export const WORK_STYLE_LABELS: Record<WorkStyle, string> = {
  introvert: 'انطوائي — يُفضّل العمل المنفرد',
  extrovert: 'انبساطي — يُفضّل التفاعل الاجتماعي',
  ambivert: 'متوازن — يتكيّف مع الوضعين',
};

// ─── Environmental Preferences ──────────────────────────────────────────────

export interface EnvironmentalPreferences {
  // درجة الحرارة المفضّلة
  temperaturePreferred: number;       // 18–28°C
  temperatureTolerance: number;       // ±درجات مقبولة

  // الإضاءة المفضّلة
  illuminancePreferred: number;       // 100–1000 lux
  illuminanceTolerance: number;       // ±lux مقبولة
  naturalLightPreference: 'high' | 'medium' | 'low'; // تفضيل الضوء الطبيعي

  // الضوضاء
  noisePreferred: number;             // 25–70 dB
  noiseTolerance: number;             // ±dB مقبولة
  noiseSensitivity: SensitivityLevel;

  // جودة الهواء
  co2Sensitivity: SensitivityLevel;
  ventilationPreference: 'high' | 'medium' | 'low';

  // الرطوبة
  humidityPreferred: number;          // 30–60%
  humidityTolerance: number;

  // الحركة والنشاط
  movementFrequency: 'frequent' | 'moderate' | 'rare'; // تكرار الحركة
  standingDeskPreference: boolean;
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  role: string;                        // المسمى الوظيفي
  department: string;                  // القسم
  avatar: string;                      // رمز الأفاتار (emoji)
  workStyle: WorkStyle;
  primaryActivity: ActivityType;
  secondaryActivities: ActivityType[];
  healthConditions: HealthCondition[];
  preferences: EnvironmentalPreferences;
  wellnessScore: number;               // درجة الرفاهية الشخصية (0–100)
  createdAt: Date;
  lastUpdated: Date;
  preferredZones: string[];            // المناطق المفضّلة
  notes: string;                       // ملاحظات خاصة
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

// ─── Personal Wellness Score Calculator ─────────────────────────────────────

export interface WellnessMatch {
  overall: number;           // 0–100
  temperature: number;
  illuminance: number;
  noise: number;
  airQuality: number;
  humidity: number;
  details: string[];         // تفاصيل التطابق
  mismatches: string[];      // حالات عدم التطابق
}

export function calculateWellnessMatch(
  profile: UserProfile,
  sensorData: {
    temperature: number;
    illuminance: number;
    noise: number;
    co2: number;
    humidity: number;
  }
): WellnessMatch {
  const p = profile.preferences;
  const details: string[] = [];
  const mismatches: string[] = [];

  // Temperature match
  const tempDiff = Math.abs(sensorData.temperature - p.temperaturePreferred);
  const tempScore = Math.max(0, 100 - (tempDiff / p.temperatureTolerance) * 50);
  if (tempScore >= 80) details.push(`درجة الحرارة مناسبة (${sensorData.temperature}°C)`);
  else mismatches.push(`درجة الحرارة ${sensorData.temperature}°C بعيدة عن المفضّلة ${p.temperaturePreferred}°C`);

  // Illuminance match
  const luxDiff = Math.abs(sensorData.illuminance - p.illuminancePreferred);
  const luxScore = Math.max(0, 100 - (luxDiff / p.illuminanceTolerance) * 50);
  if (luxScore >= 80) details.push(`مستوى الإضاءة مناسب (${sensorData.illuminance} lux)`);
  else mismatches.push(`الإضاءة ${sensorData.illuminance} lux بعيدة عن المفضّلة ${p.illuminancePreferred} lux`);

  // Noise match
  const noiseDiff = Math.abs(sensorData.noise - p.noisePreferred);
  const noiseSensMultiplier = p.noiseSensitivity === 'high' ? 2 : p.noiseSensitivity === 'medium' ? 1.5 : 1;
  const noiseScore = Math.max(0, 100 - (noiseDiff / p.noiseTolerance) * 50 * noiseSensMultiplier);
  if (noiseScore >= 80) details.push(`مستوى الضوضاء مناسب (${sensorData.noise} dB)`);
  else mismatches.push(`الضوضاء ${sensorData.noise} dB ${sensorData.noise > p.noisePreferred ? 'أعلى' : 'أقل'} من المفضّلة`);

  // Air quality match
  const co2SensMultiplier = p.co2Sensitivity === 'high' ? 1.5 : p.co2Sensitivity === 'medium' ? 1.2 : 1;
  const co2Score = sensorData.co2 <= 1000
    ? Math.max(0, 100 - ((sensorData.co2 - 400) / 600) * 30 * co2SensMultiplier)
    : Math.max(0, 100 - ((sensorData.co2 - 1000) / 500) * 80 * co2SensMultiplier);
  if (co2Score >= 80) details.push(`جودة الهواء جيدة (CO₂: ${sensorData.co2} ppm)`);
  else mismatches.push(`تركيز CO₂ مرتفع (${sensorData.co2} ppm) — حساسية ${SENSITIVITY_LABELS[p.co2Sensitivity]}`);

  // Humidity match
  const humidDiff = Math.abs(sensorData.humidity - p.humidityPreferred);
  const humidScore = Math.max(0, 100 - (humidDiff / p.humidityTolerance) * 50);
  if (humidScore >= 80) details.push(`الرطوبة مناسبة (${sensorData.humidity}%)`);
  else mismatches.push(`الرطوبة ${sensorData.humidity}% بعيدة عن المفضّلة ${p.humidityPreferred}%`);

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
  wellCategory: string;
  matchScore: number;
}

export function generatePersonalRecommendations(
  profile: UserProfile,
  currentZone: string,
  match: WellnessMatch,
  allZonesData: Array<{ id: string; name: string; sensorData: any }>
): PersonalRecommendation[] {
  const recommendations: PersonalRecommendation[] = [];
  const p = profile.preferences;

  // إذا كانت البيئة الحالية مثالية
  if (match.overall >= 85) {
    recommendations.push({
      id: `opt-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'optimal',
      priority: 'low',
      title: 'البيئة الحالية مثالية لك',
      description: `المنطقة الحالية تُحقق ${match.overall}% من أفضلياتك البيئية وفق WELL v2`,
      action: 'استمر في عملك — البيئة مهيّأة لإنتاجيتك المثلى',
      wellCategory: 'Mind & Comfort',
      matchScore: match.overall,
    });
    return recommendations;
  }

  // توصية تغيير المنطقة — إيجاد أفضل منطقة
  const betterZone = allZonesData
    .filter(z => z.id !== currentZone)
    .map(z => ({
      ...z,
      match: calculateWellnessMatch(profile, z.sensorData),
    }))
    .sort((a, b) => b.match.overall - a.match.overall)[0];

  if (betterZone && betterZone.match.overall > match.overall + 10) {
    recommendations.push({
      id: `zone-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'zone_change',
      priority: betterZone.match.overall - match.overall > 25 ? 'high' : 'medium',
      title: `انتقل إلى ${betterZone.name}`,
      description: `${betterZone.name} تُحقق ${betterZone.match.overall}% من أفضلياتك مقارنةً بـ ${match.overall}% في موقعك الحالي`,
      action: `احجز مقعداً في ${betterZone.name} للحصول على بيئة أفضل بنسبة ${betterZone.match.overall - match.overall}%`,
      wellCategory: 'Mind & Comfort',
      matchScore: betterZone.match.overall,
    });
  }

  // توصيات تعديل البيئة
  if (match.temperature < 70) {
    const isHot = p.temperaturePreferred < 22;
    recommendations.push({
      id: `temp-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'environment_adjust',
      priority: match.temperature < 50 ? 'high' : 'medium',
      title: `اضبط درجة الحرارة`,
      description: `تُفضّل ${p.temperaturePreferred}°C — درجة الحرارة الحالية لا تناسبك`,
      action: isHot
        ? `اطلب خفض التكييف إلى ${p.temperaturePreferred}°C أو انتقل لمنطقة أبرد`
        : `اطلب رفع درجة الحرارة إلى ${p.temperaturePreferred}°C أو ارتدِ طبقة إضافية`,
      wellCategory: 'Thermal Comfort',
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
      title: `مستوى الضوضاء يؤثر على إنتاجيتك`,
      description: `حساسيتك للضوضاء ${SENSITIVITY_LABELS[p.noiseSensitivity]} — المستوى الحالي أعلى من مفضّلتك`,
      action: p.noiseSensitivity === 'high'
        ? 'استخدم سماعات عازلة للصوت أو انتقل لمنطقة التركيز الهادئة'
        : 'انتقل لمنطقة أهدأ أو استخدم سماعات موسيقى تركيز',
      wellCategory: 'Sound',
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
      title: `الإضاءة لا تناسب نشاطك`,
      description: `تُفضّل ${p.illuminancePreferred} lux لنشاط "${ACTIVITY_LABELS[profile.primaryActivity]}"`,
      action: p.illuminancePreferred > 400
        ? 'اطلب رفع مستوى الإضاءة أو انتقل لمنطقة بإضاءة طبيعية أعلى'
        : 'اطلب خفض الإضاءة أو استخدم مصباح مكتبي بدرجة حرارة لون دافئة',
      wellCategory: 'Light',
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
        ? 'تحذير صحي: جودة الهواء تؤثر على حالتك'
        : 'جودة الهواء أقل من مفضّلتك',
      description: `حساسيتك لجودة الهواء ${SENSITIVITY_LABELS[p.co2Sensitivity]}`,
      action: 'انتقل لمنطقة بتهوية أفضل أو اطلب فتح نوافذ التهوية',
      wellCategory: 'Air',
      matchScore: match.airQuality,
    });
  }

  // توصية الحركة
  if (p.movementFrequency === 'frequent') {
    recommendations.push({
      id: `move-${profile.id}`,
      userId: profile.id,
      userName: profile.name,
      type: 'break',
      priority: 'low',
      title: 'وقت للحركة',
      description: 'بناءً على نمط عملك، يُنصح بأخذ استراحة حركية كل 45 دقيقة',
      action: p.standingDeskPreference
        ? 'انتقل للوقوف على مكتب قابل للتعديل أو خذ جولة قصيرة'
        : 'خذ استراحة 5 دقائق للتمدد والحركة',
      wellCategory: 'Movement',
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
      name: 'سارة الأحمدي',
      role: 'مصممة جرافيك',
      department: 'التصميم الإبداعي',
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
      wellnessScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-1', 'zone-6'],
      notes: 'تُفضّل الإضاءة الطبيعية وتحتاج بيئة هادئة للتركيز الإبداعي',
    },
    {
      id: 'user-002',
      name: 'محمد العمري',
      role: 'مدير مشاريع',
      department: 'إدارة المشاريع',
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
      wellnessScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-2', 'zone-3'],
      notes: 'يعقد اجتماعات متكررة ويحتاج مساحات تعاونية',
    },
    {
      id: 'user-003',
      name: 'نورة السالم',
      role: 'محللة بيانات',
      department: 'تقنية المعلومات',
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
      wellnessScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-1'],
      notes: 'تحتاج هواءً نقياً بسبب الربو ومكتباً قابلاً للتعديل لآلام الظهر',
    },
    {
      id: 'user-004',
      name: 'خالد الزهراني',
      role: 'مهندس معماري',
      department: 'التصميم والهندسة',
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
      wellnessScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-6', 'zone-2'],
      notes: 'يحتاج إضاءة عالية للعمل على المخططات والنماذج',
    },
    {
      id: 'user-005',
      name: 'ريم الحربي',
      role: 'أخصائية موارد بشرية',
      department: 'الموارد البشرية',
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
      wellnessScore: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      preferredZones: ['zone-3', 'zone-4'],
      notes: 'تُفضّل بيئة دافئة وتحتاج خصوصية للمقابلات',
    },
  ];
}

// ─── Local Storage Persistence ──────────────────────────────────────────────

const STORAGE_KEY = 'well_user_profiles';

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
      return JSON.parse(stored).map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        lastUpdated: new Date(p.lastUpdated),
      }));
    }
  } catch (e) {
    console.warn('Failed to load profiles from localStorage');
  }
  return createSampleProfiles();
}
