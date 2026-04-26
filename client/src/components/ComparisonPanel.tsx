/**
 * ComparisonPanel — Tool C: Compare two design scenarios
 * Shows wellness scores before and after design interventions.
 * The "after" plan can be edited: change glazing type, move seats, etc.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useArchitect } from '@/contexts/ArchitectContext';
import { calculateSeatEnvironment, FloorPlan } from '@/lib/floorPlanEngine';
import { diagnoseEmployee, compareScenarios, ComparisonSummary } from '@/lib/architectEngine';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type GlazingType = 'single' | 'double' | 'low-e' | 'triple';

const GLAZING_LABELS: Record<GlazingType, string> = {
  single: 'زجاج أحادي (الحالي)',
  double: 'زجاج مزدوج',
  'low-e': 'Low-E مزدوج (موصى به)',
  triple: 'زجاج ثلاثي',
};

const GLAZING_SPECS: Record<GlazingType, string> = {
  single: 'U = 5.8 W/m²K — SHGC = 0.86',
  double: 'U = 2.8 W/m²K — SHGC = 0.60',
  'low-e': 'U = 1.4 W/m²K — SHGC = 0.25',
  triple: 'U = 0.8 W/m²K — SHGC = 0.15',
};

function ScoreDelta({ before, after }: { before: number; after: number }) {
  const delta = after - before;
  const color = delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-500' : 'text-muted-foreground';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return (
    <span className={`font-bold text-sm ${color}`}>
      {arrow} {delta > 0 ? '+' : ''}{delta}%
    </span>
  );
}

function EmployeeRow({ result }: { result: ComparisonSummary['results'][0] }) {
  const improved = result.improvement > 0;
  const declined = result.improvement < 0;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      improved ? 'border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/20' :
      declined ? 'border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20' :
      'border-border bg-card'
    }`}>
      <span className="text-xl">{result.employeeAvatar}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{result.employeeName}</p>
        <p className="text-[10px] text-muted-foreground">{result.seatLabel}</p>
      </div>

      {/* Before */}
      <div className="text-center w-14">
        <div className="text-sm font-bold" style={{ color: result.beforeScore >= 80 ? '#22c55e' : result.beforeScore >= 60 ? '#f59e0b' : '#ef4444' }}>
          {result.beforeScore}%
        </div>
        <div className="text-[10px] text-muted-foreground">{result.beforeGaps} فجوة</div>
      </div>

      <span className="text-muted-foreground text-xs">→</span>

      {/* After */}
      <div className="text-center w-14">
        <div className="text-sm font-bold" style={{ color: result.afterScore >= 80 ? '#22c55e' : result.afterScore >= 60 ? '#f59e0b' : '#ef4444' }}>
          {result.afterScore}%
        </div>
        <div className="text-[10px] text-muted-foreground">{result.afterGaps} فجوة</div>
      </div>

      <ScoreDelta before={result.beforeScore} after={result.afterScore} />
    </div>
  );
}

export default function ComparisonPanel() {
  const { plan, setPlanAfter, profiles, city, simulationDate } = useArchitect();
  const [southGlazing, setSouthGlazing] = useState<GlazingType>('low-e');
  const [westGlazing, setWestGlazing] = useState<GlazingType>('low-e');
  const [addPartitions, setAddPartitions] = useState(true);
  const [improveVentilation, setImproveVentilation] = useState(true);

  // Build "after" plan based on selected interventions
  const computedAfterPlan = useMemo((): FloorPlan => {
    // 1. Update glazing types on windows
    let windows = plan.windows.map(w => {
      if (w.orientation === 'south') return { ...w, glazingType: southGlazing };
      if (w.orientation === 'west') return { ...w, glazingType: westGlazing };
      return w;
    });

    // 2. Ventilation improvement: add extra north window to improve air circulation
    if (improveVentilation) {
      windows = [
        ...windows,
        { id: 'win-vent-n1', wallId: 'w-north', x: 450, y: 50, width: 80, height: 10, orientation: 'north' as const, glazingType: 'double' as const },
        { id: 'win-vent-n2', wallId: 'w-north', x: 620, y: 50, width: 80, height: 10, orientation: 'north' as const, glazingType: 'double' as const },
      ];
    }

    // 3. Acoustic partitions: move seats slightly away from open area (simulated by adjusting noise)
    // We model this by adding interior walls as acoustic barriers
    const extraWalls = addPartitions ? [
      ...plan.walls,
      { id: 'w-acoustic-1', x1: 250, y1: 150, x2: 250, y2: 380, type: 'interior' as const, thickness: 8 },
      { id: 'w-acoustic-2', x1: 500, y1: 150, x2: 500, y2: 380, type: 'interior' as const, thickness: 8 },
    ] : plan.walls;

    return { ...plan, windows, walls: extraWalls };
  }, [plan, southGlazing, westGlazing, improveVentilation, addPartitions]);

  useEffect(() => {
    setPlanAfter(computedAfterPlan);
  }, [computedAfterPlan, setPlanAfter]);

  // Pass LED compensation flag to comparison engine
  const summary = useMemo((): ComparisonSummary => {
    const assignedSeats = plan.seats.filter(s => s.userId);
    const ledCompensation = (southGlazing === 'low-e' || southGlazing === 'triple' ||
      westGlazing === 'low-e' || westGlazing === 'triple');
    return compareScenarios(profiles, assignedSeats, plan, computedAfterPlan, city, ledCompensation);
  }, [plan, computedAfterPlan, profiles, city, southGlazing, westGlazing]);

  if (summary.totalEmployees === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <span className="text-4xl mb-3">⚖️</span>
        <p className="text-sm font-medium">لا يوجد موظفون مُعيَّنون لمقاعد في المخطط</p>
        <p className="text-xs mt-1">اذهب إلى تبويب "المخطط" وعيّن موظفين للمقاعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Intervention controls */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold">اختر التدخلات التصميمية للسيناريو "بعد"</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">زجاج الواجهة الجنوبية</label>
            <Select value={southGlazing} onValueChange={v => setSouthGlazing(v as GlazingType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GLAZING_LABELS) as GlazingType[]).map(g => (
                  <SelectItem key={g} value={g}>{GLAZING_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">{GLAZING_SPECS[southGlazing]}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">زجاج الواجهة الغربية</label>
            <Select value={westGlazing} onValueChange={v => setWestGlazing(v as GlazingType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GLAZING_LABELS) as GlazingType[]).map(g => (
                  <SelectItem key={g} value={g}>{GLAZING_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">{GLAZING_SPECS[westGlazing]}</p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
              addPartitions ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card border-border text-muted-foreground'
            }`}
            onClick={() => setAddPartitions(!addPartitions)}
          >
            🧱 إضافة حواجز صوتية
          </button>
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
              improveVentilation ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card border-border text-muted-foreground'
            }`}
            onClick={() => setImproveVentilation(!improveVentilation)}
          >
            🌬️ تحسين التهوية
          </button>
        </div>
      </div>

      {/* Summary comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">قبل التدخل</p>
          <div className="text-4xl font-bold text-orange-500">{summary.avgBefore}%</div>
          <p className="text-xs text-muted-foreground mt-1">متوسط الرفاهية</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">بعد التدخل</p>
          <div className="text-4xl font-bold text-green-500">{summary.avgAfter}%</div>
          <p className="text-xs text-muted-foreground mt-1">متوسط الرفاهية</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-500">+{summary.avgImprovement}%</div>
            <div className="text-xs text-muted-foreground">تحسّن كلي</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-500">{summary.employeesImproved}</div>
            <div className="text-xs text-muted-foreground">موظف تحسّن</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-500">{summary.totalEmployees}</div>
            <div className="text-xs text-muted-foreground">إجمالي الموظفين</div>
          </div>
        </div>

        {/* Visual bar comparison */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs w-16 text-right text-muted-foreground">قبل</span>
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-orange-400 rounded-full transition-all duration-700" style={{ width: `${summary.avgBefore}%` }} />
            </div>
            <span className="text-xs w-10 font-bold text-orange-500">{summary.avgBefore}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs w-16 text-right text-muted-foreground">بعد</span>
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${summary.avgAfter}%` }} />
            </div>
            <span className="text-xs w-10 font-bold text-green-500">{summary.avgAfter}%</span>
          </div>
        </div>
      </div>

      {/* Per-employee results */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          النتائج لكل موظف
        </h3>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-1">
          <span>الاسم</span>
          <div className="flex-1" />
          <span className="w-14 text-center">قبل</span>
          <span className="w-4" />
          <span className="w-14 text-center">بعد</span>
          <span className="w-12 text-center">التغيير</span>
        </div>
        {summary.results
          .sort((a, b) => b.improvement - a.improvement)
          .map(r => (
            <EmployeeRow key={r.employeeId} result={r} />
          ))}
      </div>

      {/* WELL v2 note */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>ملاحظة WELL v2:</strong> الأرقام مبنية على محاكاة بيئية وفق معادلات الكسب الحراري وتوهين الضوء والضوضاء.
          تعكس التوجه النسبي للتحسين وليست قياسات حقيقية بمستشعرات — وهو ما يُعرَّف بـ "Simulation-based validation" في البحث الأكاديمي.
        </p>
      </div>
    </div>
  );
}
