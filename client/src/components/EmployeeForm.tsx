/**
 * EmployeeForm — نموذج إدخال بيانات موظف جديد أو تعديل موظف موجود
 * يشمل: الاسم، الوظيفة، نوع العمل، التفضيلات البيئية، الحالات الصحية
 */
import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useArchitect } from '@/contexts/ArchitectContext';
import {
  UserProfile,
  ActivityType,
  WorkStyle,
  HealthCondition,
  ACTIVITY_LABELS,
  WORK_STYLE_LABELS,
  HEALTH_LABELS,
  DEFAULT_PREFERENCES_BY_ACTIVITY,
  applyHealthAdjustments,
  EnvironmentalPreferences,
  WELL_RANGES,
} from '@/lib/userProfileEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

const AVATARS = ['👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '👨‍🏫', '👩‍🏫'];
const ACTIVITIES: ActivityType[] = ['deep_focus', 'collaborative', 'creative', 'administrative', 'meeting', 'learning'];
const WORK_STYLES: WorkStyle[] = ['introvert', 'extrovert', 'ambivert'];
const HEALTH_CONDITIONS: HealthCondition[] = ['none', 'asthma', 'migraine', 'back_pain', 'eye_strain', 'heat_sensitive', 'cold_sensitive'];

interface Props {
  editProfile?: UserProfile | null;
  onClose: () => void;
}

export default function EmployeeForm({ editProfile, onClose }: Props) {
  const { addProfile, updateProfile } = useArchitect();

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [avatar, setAvatar] = useState('👨‍💼');
  const [workStyle, setWorkStyle] = useState<WorkStyle>('ambivert');
  const [activity, setActivity] = useState<ActivityType>('deep_focus');
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>(['none']);
  const [notes, setNotes] = useState('');
  const [tempPref, setTempPref] = useState(22);
  const [illumPref, setIllumPref] = useState(400);
  const [noisePref, setNoisePref] = useState(40);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load existing profile if editing
  useEffect(() => {
    if (editProfile) {
      setName(editProfile.name);
      setRole(editProfile.role);
      setDepartment(editProfile.department);
      setAvatar(editProfile.avatar);
      setWorkStyle(editProfile.workStyle);
      setActivity(editProfile.primaryActivity);
      setHealthConditions(editProfile.healthConditions);
      setNotes(editProfile.notes);
      setTempPref(editProfile.preferences.temperaturePreferred);
      setIllumPref(editProfile.preferences.illuminancePreferred);
      setNoisePref(editProfile.preferences.noisePreferred);
    }
  }, [editProfile]);

  // Auto-fill preferences when activity changes
  const handleActivityChange = (act: ActivityType) => {
    setActivity(act);
    const defaults = DEFAULT_PREFERENCES_BY_ACTIVITY[act];
    if (defaults.temperaturePreferred) setTempPref(defaults.temperaturePreferred);
    if (defaults.illuminancePreferred) setIllumPref(defaults.illuminancePreferred);
    if (defaults.noisePreferred) setNoisePref(defaults.noisePreferred);
  };

  const toggleHealth = (cond: HealthCondition) => {
    if (cond === 'none') {
      setHealthConditions(['none']);
      return;
    }
    setHealthConditions(prev => {
      const without = prev.filter(c => c !== 'none');
      const next = without.includes(cond)
        ? without.filter(c => c !== cond)
        : [...without, cond];
      return next.length > 0 ? next : ['none'];
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    const basePrefs = { ...DEFAULT_PREFERENCES_BY_ACTIVITY[activity] } as EnvironmentalPreferences;
    const adjustedPrefs = applyHealthAdjustments(basePrefs, healthConditions);
    const finalPrefs: EnvironmentalPreferences = {
      ...adjustedPrefs,
      temperaturePreferred: tempPref,
      illuminancePreferred: illumPref,
      noisePreferred: noisePref,
    };

    if (editProfile) {
      updateProfile(editProfile.id, {
        name, role, department, avatar, workStyle,
        primaryActivity: activity,
        healthConditions,
        preferences: finalPrefs,
        notes,
        lastUpdated: new Date(),
      });
    } else {
      const newProfile: UserProfile = {
        id: `user-${nanoid(10)}`,
        name, role, department, avatar, workStyle,
        primaryActivity: activity,
        secondaryActivities: [],
        healthConditions,
        preferences: finalPrefs,
        wellnessScore: 70,
        createdAt: new Date(),
        lastUpdated: new Date(),
        preferredZones: [],
        notes,
      };
      addProfile(newProfile);
    }
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-h-[80vh] overflow-y-auto">
      <h3 className="text-base font-semibold text-foreground">
        {editProfile ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
      </h3>

      {/* Avatar */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">الصورة الرمزية</Label>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map(a => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`text-xl p-1.5 rounded-lg transition-all ${
                avatar === a ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">الاسم *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: سارة الأحمد" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">المسمى الوظيفي</Label>
          <Input value={role} onChange={e => setRole(e.target.value)} placeholder="مثال: مصمم جرافيك" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">القسم</Label>
          <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="مثال: التصميم" className="h-8 text-sm" />
        </div>
      </div>

      {/* Work style */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">أسلوب العمل</Label>
        <div className="flex flex-wrap gap-2">
          {WORK_STYLES.map(ws => (
            <button
              key={ws}
              onClick={() => setWorkStyle(ws)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${
                workStyle === ws ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {WORK_STYLE_LABELS[ws].split(' — ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Primary activity */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">طبيعة العمل الأساسية</Label>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map(act => (
            <button
              key={act}
              onClick={() => handleActivityChange(act)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${
                activity === act ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {ACTIVITY_LABELS[act]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">اختيار طبيعة العمل يُعيّن التفضيلات البيئية تلقائياً</p>
      </div>

      {/* Health conditions */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">الحالات الصحية الخاصة</Label>
        <div className="flex flex-wrap gap-2">
          {HEALTH_CONDITIONS.map(cond => (
            <button
              key={cond}
              onClick={() => toggleHealth(cond)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${
                healthConditions.includes(cond)
                  ? cond === 'none' ? 'bg-muted text-muted-foreground ring-1 ring-border' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-400'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {HEALTH_LABELS[cond]}
            </button>
          ))}
        </div>
      </div>

      {/* Environmental preferences */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {showAdvanced ? '▲' : '▼'} التفضيلات البيئية التفصيلية
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 p-3 bg-muted/30 rounded-lg">
            {/* Temperature */}
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">درجة الحرارة المفضّلة</Label>
                <span className="text-xs font-semibold text-foreground">{tempPref}°C</span>
              </div>
              <Slider
                min={WELL_RANGES.temperature.min}
                max={WELL_RANGES.temperature.max}
                step={0.5}
                value={[tempPref]}
                onValueChange={([v]) => setTempPref(v)}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{WELL_RANGES.temperature.min}°C</span>
                <span className="text-emerald-600 dark:text-emerald-400">WELL: {WELL_RANGES.temperature.wellMin}–{WELL_RANGES.temperature.wellMax}°C</span>
                <span>{WELL_RANGES.temperature.max}°C</span>
              </div>
            </div>

            {/* Illuminance */}
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">مستوى الإضاءة المفضّل</Label>
                <span className="text-xs font-semibold text-foreground">{illumPref} lux</span>
              </div>
              <Slider
                min={WELL_RANGES.illuminance.min}
                max={WELL_RANGES.illuminance.max}
                step={25}
                value={[illumPref]}
                onValueChange={([v]) => setIllumPref(v)}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{WELL_RANGES.illuminance.min}</span>
                <span className="text-emerald-600 dark:text-emerald-400">WELL: {WELL_RANGES.illuminance.wellMin}–{WELL_RANGES.illuminance.wellMax} lux</span>
                <span>{WELL_RANGES.illuminance.max}</span>
              </div>
            </div>

            {/* Noise */}
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">الحد الأقصى للضوضاء المقبولة</Label>
                <span className="text-xs font-semibold text-foreground">{noisePref} dB</span>
              </div>
              <Slider
                min={WELL_RANGES.noise.min}
                max={WELL_RANGES.noise.max}
                step={1}
                value={[noisePref]}
                onValueChange={([v]) => setNoisePref(v)}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{WELL_RANGES.noise.min} dB</span>
                <span className="text-emerald-600 dark:text-emerald-400">WELL: {WELL_RANGES.noise.wellMin}–{WELL_RANGES.noise.wellMax} dB</span>
                <span>{WELL_RANGES.noise.max} dB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">ملاحظات خاصة</Label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="أي ملاحظات إضافية عن احتياجات هذا الموظف..."
          className="w-full text-sm bg-muted/30 border border-border rounded-lg p-2 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSubmit} disabled={!name.trim()} className="flex-1 h-8 text-sm">
          {editProfile ? 'حفظ التعديلات' : 'إضافة الموظف'}
        </Button>
        <Button variant="outline" onClick={onClose} className="h-8 text-sm px-4">
          إلغاء
        </Button>
      </div>
    </div>
  );
}
