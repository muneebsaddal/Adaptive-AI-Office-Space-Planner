/**
 * GenerationPanel — Tool B: Generate design recommendations card
 * Aggregates all employee gaps and produces actionable design specs.
 */
import React, { useMemo } from 'react';
import { useArchitect } from '@/contexts/ArchitectContext';
import { calculateSeatEnvironment } from '@/lib/floorPlanEngine';
import { diagnoseEmployee, generateDesignCard, DesignRecommendation } from '@/lib/architectEngine';
import { Badge } from '@/components/ui/badge';

const CATEGORY_ICONS: Record<string, string> = {
  glazing: '🪟',
  partition: '🧱',
  lighting: '💡',
  ventilation: '🌬️',
  shading: '🌂',
  layout: '📐',
};

const CATEGORY_LABELS: Record<string, string> = {
  glazing: 'Glazing',
  partition: 'Acoustic partitions',
  lighting: 'Lighting system',
  ventilation: 'Ventilation',
  shading: 'Shading',
  layout: 'Spatial layout',
};

const PRIORITY_COLORS = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
};

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
};

function RecommendationCard({ rec }: { rec: DesignRecommendation }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl">{CATEGORY_ICONS[rec.category]}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[rec.category]}</Badge>
            <Badge className={`text-[10px] ${PRIORITY_COLORS[rec.priority]}`}>
              {PRIORITY_LABELS[rec.priority]}
            </Badge>
            <span className="text-xs text-muted-foreground">Affects {rec.affectedCount} employees</span>
          </div>
          <h3 className="font-semibold text-sm">{rec.titleAr}</h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">{rec.descriptionAr}</p>

      {/* Technical spec */}
      <div className="bg-muted/50 rounded-lg p-3 border border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Technical spec</p>
        <p className="text-xs font-mono">{rec.technicalSpec}</p>
      </div>

      {/* comfort criteria */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{rec.criteria}</span>
      </div>
    </div>
  );
}

export default function GenerationPanel() {
  const { plan, profiles, city, simulationDate } = useArchitect();

  const { card, diagnoses } = useMemo(() => {
    const diags = plan.seats
      .filter(s => s.userId)
      .map(seat => {
        const profile = profiles.find(p => p.id === seat.userId)!;
        const env = calculateSeatEnvironment(seat, plan, city, simulationDate);
        return diagnoseEmployee(profile, seat, env);
      });
    return { card: generateDesignCard(diags), diagnoses: diags };
  }, [plan, profiles, city, simulationDate]);

  const avgScore = diagnoses.length
    ? Math.round(diagnoses.reduce((s, d) => s + d.comfortMatch.overall, 0) / diagnoses.length)
    : 0;

  const projectedScore = Math.min(100, avgScore + card.expectedComfortGain);

  if (diagnoses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <span className="text-4xl mb-3">📐</span>
        <p className="text-sm font-medium">No employees are assigned to seats</p>
        <p className="text-xs mt-1">Go to the Plan tab and assign employees to seats</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Design Card Header */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-base">Design card</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{card.zone}</p>
          </div>
          <Badge className="bg-indigo-600 text-white text-xs">
            {card.recommendations.length} recommendations
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/70 dark:bg-black/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{card.affectedEmployees}</div>
            <div className="text-[10px] text-muted-foreground">employees need intervention</div>
          </div>
          <div className="bg-white/70 dark:bg-black/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{avgScore}%</div>
            <div className="text-[10px] text-muted-foreground">Current comfort</div>
          </div>
          <div className="bg-white/70 dark:bg-black/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{projectedScore}%</div>
            <div className="text-[10px] text-muted-foreground">After implementation</div>
          </div>
        </div>

        {/* Progress arrow */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 h-3 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${avgScore}%` }} />
          </div>
          <span className="text-xs font-bold text-green-600">+{card.expectedComfortGain}%</span>
          <div className="flex-1 h-3 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${projectedScore}%` }} />
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>Before intervention</span>
          <span>After intervention</span>
        </div>
      </div>

      {/* Recommendations */}
      {card.recommendations.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Design recommendations ({card.recommendations.length})
          </h3>
          {card.recommendations
            .sort((a, b) => {
              const order = { critical: 0, high: 1, medium: 2 };
              return order[a.priority] - order[b.priority];
            })
            .map(rec => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
        </div>
      ) : (
        <div className="text-center py-8 text-green-600 dark:text-green-400">
          <span className="text-3xl block mb-2">✓</span>
          <p className="text-sm font-medium">All employees are in a strong environment</p>
          <p className="text-xs text-muted-foreground mt-1">No design recommendations are needed right now</p>
        </div>
      )}

      {/* Employee breakdown */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Gap distribution by parameter
        </h3>
        <div className="space-y-2">
          {['temperature', 'illuminance', 'noise', 'co2', 'humidity'].map(param => {
            const count = diagnoses.filter(d => d.gaps.some(g => g.parameter === param)).length;
            const pct = diagnoses.length ? Math.round((count / diagnoses.length) * 100) : 0;
            const icons: Record<string, string> = { temperature: '🌡️', illuminance: '💡', noise: '🔊', co2: '💨', humidity: '💧' };
            const labels: Record<string, string> = { temperature: 'Temperature', illuminance: 'Light', noise: 'Noise', co2: 'Air', humidity: 'Humidity' };
            return (
              <div key={param} className="flex items-center gap-3">
                <span className="text-sm w-5">{icons[param]}</span>
                <span className="text-xs w-14">{labels[param]}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct > 50 ? 'bg-red-500' : pct > 25 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-left">{count}/{diagnoses.length} employees</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
