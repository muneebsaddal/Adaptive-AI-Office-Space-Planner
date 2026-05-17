import React, { useState } from 'react';
import { ArchitectProvider, useArchitect } from '@/contexts/ArchitectContext';
import FloorPlanEditor from '@/components/FloorPlanEditor';
import DiagnosisPanel from '@/components/DiagnosisPanel';
import GenerationPanel from '@/components/GenerationPanel';
import ComparisonPanel from '@/components/ComparisonPanel';
import TimeSeasonBar from '@/components/TimeSeasonBar';
import EmployeeForm from '@/components/EmployeeForm';
import PlanImportPanel from '@/components/PlanImportPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/lib/userProfileEngine';
import { CITY_OPTIONS, createDefaultAfterPlan, createDefaultFloorPlan, FloorPlan } from '@/lib/floorPlanEngine';

const TABS = [
  { id: 'plan', label: 'Plan', icon: '📐', desc: 'Draw and assign seats' },
  { id: 'diagnosis', label: 'Diagnosis', icon: '🔍', desc: 'Employee gap analysis' },
  { id: 'generation', label: 'Generation', icon: '⚙️', desc: 'Design intervention card' },
  { id: 'comparison', label: 'Comparison', icon: '⚖️', desc: 'Before and after impact' },
] as const;

type TabId = 'plan' | 'diagnosis' | 'generation' | 'comparison';

const HEALTH_LABELS: Record<string, string> = {
  heat_sensitive: 'Heat sensitive',
  migraine: 'Migraine',
  asthma: 'Asthma',
  eye_strain: 'Eye strain',
  back_pain: 'Back pain',
  cold_sensitive: 'Cold sensitive',
};

function AppContent() {
  const {
    plan, setPlan, profiles, deleteProfile,
    selectedSeatId, setSelectedSeatId,
    city, setCity,
    activeTab, setActiveTab,
    setPlanAfter,
  } = useArchitect();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);

  const assignedCount = plan.seats.filter(s => s.userId).length;
  const totalSeats = plan.seats.length;

  const handleEditProfile = (profile: UserProfile) => {
    setEditingProfile(profile);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingProfile(null);
  };

  const handlePlanImport = (nextPlan: FloorPlan) => {
    setPlan(nextPlan);
    setPlanAfter(createDefaultAfterPlan(nextPlan));
    if (nextPlan.city) {
      setCity(nextPlan.city);
    }
  };

  const handleResetPlan = () => {
    handlePlanImport(createDefaultFloorPlan());
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="ltr">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">A</div>
            <div>
              <h1 className="text-sm font-bold leading-tight">Adaptive Planning Tool</h1>
              <p className="text-[10px] text-muted-foreground">Adaptive AI Space Planning</p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">City:</span>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span>🪑 {assignedCount}/{totalSeats} assigned seats</span>
            <span>👥 {profiles.length} employees</span>
          </div>
        </div>
      </header>

      <TimeSeasonBar />

      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-4">
          {TABS.map(tab => activeTab === tab.id && (
            <div key={tab.id} className="flex items-center gap-2">
              <span className="text-lg">{tab.icon}</span>
              <div>
                <h2 className="font-bold text-base">{tab.label}</h2>
                <p className="text-xs text-muted-foreground">{tab.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {activeTab === 'plan' && (
          <div className="space-y-4">
            <PlanImportPanel
              plan={plan}
              onImportPlan={handlePlanImport}
              onResetPlan={handleResetPlan}
            />

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Interactive Plan</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Click a seat to assign an employee</span>
                </div>
              </div>
              <FloorPlanEditor
                plan={plan}
                onPlanChange={setPlan}
                profiles={profiles}
                selectedSeatId={selectedSeatId}
                onSeatSelect={setSelectedSeatId}
              />
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Employee Profiles ({profiles.length})</h3>
                <Button
                  size="sm"
                  onClick={() => { setEditingProfile(null); setShowAddForm(true); }}
                  className="h-7 text-xs gap-1"
                >
                  <span>+</span> Add Employee
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {profiles.map(p => {
                  const seat = plan.seats.find(s => s.userId === p.id);
                  return (
                    <div key={p.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border group">
                      <span className="text-xl mt-0.5">{p.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.role}{p.department ? ` - ${p.department}` : ''}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.healthConditions.filter(h => h !== 'none').map(h => (
                            <Badge key={h} variant="outline" className="text-[9px] px-1 py-0">
                              {HEALTH_LABELS[h] ?? h}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-1.5 text-[9px] text-muted-foreground">
                          <span>🌡️ {p.preferences.temperaturePreferred}°C</span>
                          <span>💡 {p.preferences.illuminancePreferred} lux</span>
                          <span>🔇 {p.preferences.noisePreferred} dB</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {seat ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                            {seat.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Unassigned
                          </Badge>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditProfile(p)}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-muted-foreground text-[10px]">|</span>
                          <button
                            onClick={() => deleteProfile(p.id)}
                            className="text-[10px] text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => { setEditingProfile(null); setShowAddForm(true); }}
                  className="flex items-center justify-center gap-2 p-3 bg-muted/10 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all text-xs"
                >
                  <span className="text-lg">+</span>
                  <span>Add New Employee</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diagnosis' && (
          <div className="max-w-3xl">
            <DiagnosisPanel />
          </div>
        )}

        {activeTab === 'generation' && (
          <div className="max-w-3xl">
            <GenerationPanel />
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="max-w-3xl">
            <ComparisonPanel />
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-12 py-4 text-center text-xs text-muted-foreground">
        <p>Adaptive AI Space Planning | Workplace Comfort Analysis Tool</p>
        <p className="mt-1 opacity-60">Environmental simulation uses thermal gain, lighting, and noise attenuation equations.</p>
      </footer>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="ltr">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseForm}
            aria-label="Close"
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
            <EmployeeForm
              editProfile={editingProfile}
              onClose={handleCloseForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ArchitectProvider>
      <AppContent />
    </ArchitectProvider>
  );
}
