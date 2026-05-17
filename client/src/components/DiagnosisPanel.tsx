/**
 * DiagnosisPanel — Tool A: Diagnose comfort gaps per employee
 * Shows each employee's current environment vs their preferences,
 * highlights gaps, and suggests spatial interventions.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useArchitect } from '@/contexts/ArchitectContext';
import { calculateSeatEnvironment } from '@/lib/floorPlanEngine';
import { diagnoseEmployee, EmployeeDiagnosis, Gap } from '@/lib/architectEngine';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const SEVERITY_COLORS = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-100 text-blue-800',
};

const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PARAM_ICONS: Record<string, string> = {
  temperature: '🌡️',
  illuminance: '💡',
  noise: '🔊',
  co2: '💨',
  humidity: '💧',
};

type InterventionDomain = 'thermal' | 'lighting' | 'acoustic' | 'air' | 'biophilic';

const PARAM_LABEL_EN: Record<Gap['parameter'], string> = {
  temperature: 'Temperature',
  illuminance: 'Illuminance',
  noise: 'Noise',
  co2: 'CO2',
  humidity: 'Humidity',
};

const INTERVENTION_DOMAIN_BY_TYPE: Record<EmployeeDiagnosis['interventions'][number]['type'], InterventionDomain> = {
  relocate: 'thermal',
  glazing: 'thermal',
  partition: 'acoustic',
  lighting: 'lighting',
  ventilation: 'air',
  shading: 'lighting',
};

function getGapDomains(diagnosis: EmployeeDiagnosis): Set<InterventionDomain> {
  const domains = new Set<InterventionDomain>();
  diagnosis.gaps.forEach((gap) => {
    if (gap.parameter === 'temperature' || gap.parameter === 'humidity') domains.add('thermal');
    if (gap.parameter === 'illuminance') domains.add('lighting');
    if (gap.parameter === 'noise') domains.add('acoustic');
    if (gap.parameter === 'co2') domains.add('air');
  });
  if (diagnosis.comfortMatch.overall < 70) domains.add('biophilic');
  return domains;
}

function ComfortBar({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const textSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-sm';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={`font-bold ${textSize}`} style={{ color: score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444' }}>
          {score}%
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function GapCard({ gap }: { gap: Gap }) {
  const dirLabel = gap.direction === 'too_high' ? '↑ High' : gap.direction === 'too_low' ? '↓ Low' : '✓';
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
      <span className="text-lg">{PARAM_ICONS[gap.parameter]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{gap.labelAr}</span>
          <Badge className={`text-[10px] px-1.5 py-0 ${SEVERITY_COLORS[gap.severity]}`}>
            {SEVERITY_LABELS[gap.severity]}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Current: <strong>{gap.current}{gap.unit}</strong> — Preferred: {gap.preferred}{gap.unit}
          <span className="ml-2 font-medium text-orange-600 dark:text-orange-400">{dirLabel}</span>
        </div>
      </div>
    </div>
  );
}

function EmployeeCard({ diagnosis, expanded, onToggle, selectedGapDomains, filterEmployeeName }: {
  diagnosis: EmployeeDiagnosis;
  expanded: boolean;
  onToggle: () => void;
  selectedGapDomains: Set<InterventionDomain> | null;
  filterEmployeeName?: string;
}) {
  const score = diagnosis.comfortMatch.overall;
  const hasGaps = diagnosis.gaps.length > 0;
  const domainFilteredInterventions = useMemo(() => {
    if (!selectedGapDomains) return diagnosis.interventions;
    return diagnosis.interventions.filter(int => selectedGapDomains.has(INTERVENTION_DOMAIN_BY_TYPE[int.type]));
  }, [diagnosis.interventions, selectedGapDomains]);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      score >= 80 ? 'border-green-200 dark:border-green-900' :
      score >= 60 ? 'border-yellow-200 dark:border-yellow-900' :
      'border-red-200 dark:border-red-900'
    }`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 bg-card hover:bg-muted/30 transition-colors text-right"
        onClick={onToggle}
      >
        <span className="text-2xl">{diagnosis.userAvatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{diagnosis.userName}</span>
            <span className="text-xs text-muted-foreground">{diagnosis.userRole}</span>
            <Badge variant="outline" className="text-[10px]">{diagnosis.seatLabel}</Badge>
          </div>
          <div className="mt-1.5 w-full max-w-[200px]">
            <ComfortBar score={score} size="sm" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasGaps ? (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
              {diagnosis.gaps.length} gaps
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
              ✓ Aligned
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 border-t border-border bg-muted/20 space-y-4">
          {/* Environment readings */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Current environment</h4>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Temperature', value: `${diagnosis.environment.estimatedTemperature}°C`, icon: '🌡️' },
                { label: 'Light', value: `${diagnosis.environment.estimatedIlluminance}`, unit: 'lux', icon: '💡' },
                { label: 'Noise', value: `${diagnosis.environment.estimatedNoise}`, unit: 'dB', icon: '🔊' },
                { label: 'CO₂', value: `${diagnosis.environment.estimatedCO2}`, unit: 'ppm', icon: '💨' },
                { label: 'Humidity', value: `${diagnosis.environment.estimatedHumidity}%`, icon: '💧' },
              ].map(item => (
                <div key={item.label} className="bg-card rounded-lg p-2 text-center border border-border">
                  <div className="text-base">{item.icon}</div>
                  <div className="text-xs font-bold mt-0.5">{item.value}</div>
                  {item.unit && <div className="text-[10px] text-muted-foreground">{item.unit}</div>}
                  <div className="text-[10px] text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gaps */}
          {diagnosis.gaps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Detected gaps</h4>
              <div className="space-y-2">
                {diagnosis.gaps.map(gap => <GapCard key={gap.parameter} gap={gap} />)}
              </div>
            </div>
          )}

          {/* Interventions */}
          {domainFilteredInterventions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Suggested interventions</h4>
              <div className="space-y-2">
                {domainFilteredInterventions.map(int => (
                  <div key={int.id} className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-start gap-2">
                      <Badge className={`text-[10px] shrink-0 ${SEVERITY_COLORS[int.priority]}`}>
                        {SEVERITY_LABELS[int.priority]}
                      </Badge>
                      <div>
                        <p className="text-xs font-semibold">{int.titleAr}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{int.descriptionAr}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">{int.criteria}</p>
                        <p className="text-[10px] text-green-600 dark:text-green-400">
                          Expected improvement: +{int.expectedImprovement}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedGapDomains && domainFilteredInterventions.length === 0 && (
            <div className="text-center py-3 text-muted-foreground text-xs">
              No interventions mapped to the selected employee gaps
              <br />
              No interventions mapped to {filterEmployeeName ?? 'selected employee'} gaps
            </div>
          )}

          {!hasGaps && (
            <div className="text-center py-3 text-green-600 dark:text-green-400 text-sm">
              ✓ The current environment matches this employee's preferences
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiagnosisPanel() {
  const { plan, profiles, city, simulationDate, hourOfDay, season } = useArchitect();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

  const diagnoses = useMemo<EmployeeDiagnosis[]>(() => { // eslint-disable-line react-hooks/exhaustive-deps
    return plan.seats
      .filter(seat => seat.userId)
      .map(seat => {
        const profile = profiles.find(p => p.id === seat.userId)!;
        const env = calculateSeatEnvironment(seat, plan, city, simulationDate);
        return diagnoseEmployee(profile, seat, env);
      })
      .sort((a, b) => a.comfortMatch.overall - b.comfortMatch.overall);
  }, [plan, profiles, city, simulationDate]);

  const avgScore = diagnoses.length
    ? Math.round(diagnoses.reduce((s, d) => s + d.comfortMatch.overall, 0) / diagnoses.length)
    : 0;

  const criticalCount = diagnoses.filter(d => d.gaps.some(g => g.severity === 'critical')).length;
  const satisfiedCount = diagnoses.filter(d => d.gaps.length === 0).length;
  const selectedDiagnosis = selectedEmployeeId === 'all'
    ? null
    : diagnoses.find(d => d.userId === selectedEmployeeId) ?? null;
  const selectedGapDomains = selectedDiagnosis ? getGapDomains(selectedDiagnosis) : null;

  useEffect(() => {
    if (selectedEmployeeId === 'all') return;
    const stillAssigned = diagnoses.some(d => d.userId === selectedEmployeeId);
    if (!stillAssigned) setSelectedEmployeeId('all');
  }, [diagnoses, selectedEmployeeId]);

  useEffect(() => {
    if (selectedDiagnosis && expandedId !== selectedDiagnosis.userId) {
      setExpandedId(selectedDiagnosis.userId);
    }
  }, [selectedDiagnosis, expandedId]);

  if (diagnoses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <span className="text-4xl mb-3">🪑</span>
        <p className="text-sm font-medium">No employees are assigned to seats</p>
        <p className="text-xs mt-1">Go to the Plan tab and assign employees to seats</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold" style={{ color: avgScore >= 80 ? '#22c55e' : avgScore >= 60 ? '#f59e0b' : '#ef4444' }}>
            {avgScore}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">Average comfort</div>
        </div>
        <div className="bg-card border border-red-200 dark:border-red-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-500">{criticalCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Critical cases</div>
        </div>
        <div className="bg-card border border-green-200 dark:border-green-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-500">{satisfiedCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Satisfied employees</div>
        </div>
      </div>

      {/* Overall bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall comfort level</span>
          <span className="text-sm font-bold">{avgScore}%</span>
        </div>
        <Progress value={avgScore} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">
          {diagnoses.length} employees — {satisfiedCount} Aligned — {diagnoses.length - satisfiedCount} need intervention
        </p>
      </div>

      {/* Employee cards */}
      <div className="space-y-3">
        <div className="bg-card border border-border rounded-xl p-3 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Employee Filter
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedEmployeeId('all')}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                selectedEmployeeId === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-card border-border hover:bg-muted/40'
              }`}
            >
              All
            </button>
            {diagnoses.map((diagnosis) => {
              const comfort = diagnosis.comfortMatch.overall;
              const isSelected = selectedEmployeeId === diagnosis.userId;
              const colorClass = comfort >= 80
                ? 'border-green-400 text-green-700 dark:text-green-300'
                : comfort >= 65
                  ? 'border-amber-400 text-amber-700 dark:text-amber-300'
                  : 'border-red-400 text-red-700 dark:text-red-300';
              return (
                <button
                  key={diagnosis.userId}
                  onClick={() => setSelectedEmployeeId(diagnosis.userId)}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                    isSelected
                      ? 'bg-muted/60 border-indigo-500'
                      : `bg-card hover:bg-muted/40 ${colorClass}`
                  }`}
                >
                  <span className="text-base">{diagnosis.userAvatar}</span>
                  <span className="font-medium">{diagnosis.userName}</span>
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0">
                    {diagnosis.gaps.length}
                  </Badge>
                  <span className="font-semibold">{comfort}%</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDiagnosis && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xl">{selectedDiagnosis.userAvatar}</span>
              <span className="font-semibold">{selectedDiagnosis.userName}</span>
              <Badge variant="outline" className="text-[10px]">{selectedDiagnosis.userRole}</Badge>
              <Badge variant="outline" className="text-[10px]">{selectedDiagnosis.seatLabel}</Badge>
              <span className="font-bold ml-auto">{selectedDiagnosis.comfortMatch.overall}%</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-right p-2">Parameter</th>
                    <th className="text-right p-2">Current</th>
                    <th className="text-right p-2">Preferred</th>
                    <th className="text-right p-2">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDiagnosis.gaps.map((gap) => (
                    <tr key={gap.parameter} className="border-t border-border">
                      <td className="p-2">{gap.labelAr} | {PARAM_LABEL_EN[gap.parameter]}</td>
                      <td className="p-2">{gap.current}{gap.unit}</td>
                      <td className="p-2">{gap.preferred}{gap.unit}</td>
                      <td className="p-2">
                        <Badge className={`text-[10px] px-1.5 py-0 ${SEVERITY_COLORS[gap.severity]}`}>
                          {SEVERITY_LABELS[gap.severity]} | {gap.severity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedDiagnosis.gaps.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No environmental gaps detected for this employee.
                <br />
                No environmental gaps detected for this employee.
              </div>
            )}

            <p className="text-xs text-blue-700 dark:text-blue-300">
              The interventions below are filtered for {selectedDiagnosis.userName} specific gaps.
              <br />
              Interventions below are filtered to address {selectedDiagnosis.userName}&apos;s specific gaps.
            </p>
          </div>
        )}

        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Employee diagnosis</h3>
        {diagnoses.map(d => (
          <EmployeeCard
            key={d.userId}
            diagnosis={d}
            expanded={expandedId === d.userId}
            onToggle={() => setExpandedId(expandedId === d.userId ? null : d.userId)}
            selectedGapDomains={selectedGapDomains}
            filterEmployeeName={selectedDiagnosis?.userName}
          />
        ))}
      </div>
    </div>
  );
}
