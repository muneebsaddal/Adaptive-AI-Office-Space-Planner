/**
 * TimeSeasonBar — شريط التحكم بالوقت والفصل
 * يظهر في أعلى التطبيق ويؤثر على جميع حسابات الرفاهية
 */
import React from 'react';
import { useArchitect, Season, SEASON_LABELS, SEASON_ICONS } from '@/contexts/ArchitectContext';
import { useLanguage } from '@/contexts/LanguageContext';

const SEASONS: Season[] = ['summer', 'autumn', 'winter', 'spring'];

function formatHour(h: number, isArabic: boolean): string {
  if (isArabic) {
    if (h === 12) return '12 ظهراً';
    if (h < 12) return `${h} صباحاً`;
    return `${h - 12} مساءً`;
  }

  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const period = h < 12 ? 'AM' : 'PM';
  return `${hour12}:00 ${period}`;
}

export default function TimeSeasonBar() {
  const { hourOfDay, setHourOfDay, season, setSeason } = useArchitect();
  const { isArabic } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-card border-b border-border text-sm">
      {/* Season selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">{isArabic ? 'الفصل:' : 'Season:'}</span>
        <div className="flex gap-1">
          {SEASONS.map(s => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                season === s
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {SEASON_ICONS[s]} {isArabic ? SEASON_LABELS[s] : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="h-4 w-px bg-border hidden sm:block" />

      {/* Hour slider */}
      <div className="flex items-center gap-3 flex-1 min-w-[220px]">
        <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">{isArabic ? 'وقت اليوم:' : 'Time:'}</span>
        <input
          type="range"
          min={7}
          max={19}
          step={1}
          value={hourOfDay}
          onChange={e => setHourOfDay(Number(e.target.value))}
          className="flex-1 h-1.5 accent-primary cursor-pointer"
        />
        <span className="text-xs font-semibold text-foreground w-20 text-center bg-muted rounded px-2 py-0.5">
          {formatHour(hourOfDay, isArabic)}
        </span>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        <span>{isArabic ? 'المحاكاة تتحدث تلقائياً' : 'Simulation updates automatically'}</span>
      </div>
    </div>
  );
}
