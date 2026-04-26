/**
 * Floor Plan Engine — WELL v2 Adaptive Space Planning
 * ====================================================
 * Manages the interactive floor plan: walls, windows, orientations,
 * and employee seat positions. Calculates environmental conditions
 * at each seat based on geometry and WELL v2 standards.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Orientation = 'north' | 'south' | 'east' | 'west';
export type WallType = 'interior' | 'exterior';
export type ElementType = 'wall' | 'window' | 'door' | 'seat';

export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: WallType;
  orientation?: Orientation; // only for exterior walls
  thickness: number; // px
}

export interface Window {
  id: string;
  wallId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: Orientation;
  glazingType: 'single' | 'double' | 'low-e' | 'triple';
}

export interface Seat {
  id: string;
  userId: string | null;
  x: number;
  y: number;
  label: string;
}

export interface CadLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer?: string;
}

export interface CadPolyline {
  points: Point[];
  closed?: boolean;
  layer?: string;
}

export interface CadArc {
  cx: number;
  cy: number;
  r: number;
  startAngle: number; // degrees
  endAngle: number;   // degrees
  layer?: string;
}

export interface CadCircle {
  cx: number;
  cy: number;
  r: number;
  layer?: string;
}

export interface CadGeometry {
  lines: CadLine[];
  polylines: CadPolyline[];
  arcs: CadArc[];
  circles: CadCircle[];
}

export interface ImportDiagnostics {
  wallCount: number;
  windowCount: number;
  seatCount: number;
  rejectedSeats: number;
  notes: string[];
}

export interface FloorPlan {
  id: string;
  name: string;
  width: number;  // canvas width in px
  height: number; // canvas height in px
  scale: number;  // px per meter
  walls: Wall[];
  windows: Window[];
  seats: Seat[];
  city: string;
  buildingOrientation: number; // degrees, 0 = north up
  cadGeometry?: CadGeometry;
  importDiagnostics?: ImportDiagnostics;
}

function isOrientation(value: unknown): value is Orientation {
  return value === 'north' || value === 'south' || value === 'east' || value === 'west';
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function sanitizeWall(raw: unknown, index: number, fallback: Wall): Wall {
  const wall = raw as Partial<Wall> | null | undefined;
  const type: WallType = wall?.type === 'interior' ? 'interior' : 'exterior';
  const orientation = isOrientation(wall?.orientation)
    ? wall?.orientation
    : fallback.orientation ?? 'south';

  return {
    id: stringOr(wall?.id, `wall-${index + 1}`),
    x1: numberOr(wall?.x1, fallback.x1),
    y1: numberOr(wall?.y1, fallback.y1),
    x2: numberOr(wall?.x2, fallback.x2),
    y2: numberOr(wall?.y2, fallback.y2),
    type,
    orientation: type === 'exterior' ? orientation : undefined,
    thickness: numberOr(wall?.thickness, fallback.thickness),
  };
}

function sanitizeWindow(raw: unknown, index: number, fallback: Window): Window {
  const win = raw as Partial<Window> | null | undefined;
  const orientation = isOrientation(win?.orientation)
    ? win?.orientation
    : fallback.orientation;

  return {
    id: stringOr(win?.id, `win-${index + 1}`),
    wallId: stringOr(win?.wallId, fallback.wallId),
    x: numberOr(win?.x, fallback.x),
    y: numberOr(win?.y, fallback.y),
    width: numberOr(win?.width, fallback.width),
    height: numberOr(win?.height, fallback.height),
    orientation,
    glazingType: (win?.glazingType as Window['glazingType']) ?? fallback.glazingType,
  };
}

function sanitizeSeat(raw: unknown, index: number, fallback: Seat): Seat {
  const seat = raw as Partial<Seat> | null | undefined;
  const userId = typeof seat?.userId === 'string' && seat.userId.trim() ? seat.userId : null;

  return {
    id: stringOr(seat?.id, `seat-${index + 1}`),
    userId,
    x: numberOr(seat?.x, fallback.x),
    y: numberOr(seat?.y, fallback.y),
    label: stringOr(seat?.label, fallback.label),
  };
}

function sanitizeCadGeometry(raw: unknown): CadGeometry | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Partial<CadGeometry>;

  const lines: CadLine[] = [];
  if (Array.isArray(obj.lines)) {
    obj.lines.forEach((line) => {
      const l = line as Partial<CadLine> | null | undefined;
      if (!l) return;
      lines.push({
        x1: numberOr(l.x1, 0),
        y1: numberOr(l.y1, 0),
        x2: numberOr(l.x2, 0),
        y2: numberOr(l.y2, 0),
        layer: typeof l.layer === 'string' ? l.layer : undefined,
      });
    });
  }

  const polylines: CadPolyline[] = [];
  if (Array.isArray(obj.polylines)) {
    obj.polylines.forEach((polyline) => {
      const p = polyline as Partial<CadPolyline> | null | undefined;
      if (!p || !Array.isArray(p.points) || p.points.length < 2) return;
      polylines.push({
        points: p.points.map((point) => {
          const pt = point as Partial<Point> | null | undefined;
          return {
            x: numberOr(pt?.x, 0),
            y: numberOr(pt?.y, 0),
          };
        }),
        closed: Boolean(p.closed),
        layer: typeof p.layer === 'string' ? p.layer : undefined,
      });
    });
  }

  const arcs: CadArc[] = [];
  if (Array.isArray(obj.arcs)) {
    obj.arcs.forEach((arc) => {
      const a = arc as Partial<CadArc> | null | undefined;
      if (!a) return;
      const radius = Math.max(0, numberOr(a.r, 0));
      if (radius <= 0) return;
      arcs.push({
        cx: numberOr(a.cx, 0),
        cy: numberOr(a.cy, 0),
        r: radius,
        startAngle: numberOr(a.startAngle, 0),
        endAngle: numberOr(a.endAngle, 0),
        layer: typeof a.layer === 'string' ? a.layer : undefined,
      });
    });
  }

  const circles: CadCircle[] = [];
  if (Array.isArray(obj.circles)) {
    obj.circles.forEach((circle) => {
      const c = circle as Partial<CadCircle> | null | undefined;
      if (!c) return;
      const radius = Math.max(0, numberOr(c.r, 0));
      if (radius <= 0) return;
      circles.push({
        cx: numberOr(c.cx, 0),
        cy: numberOr(c.cy, 0),
        r: radius,
        layer: typeof c.layer === 'string' ? c.layer : undefined,
      });
    });
  }

  if (lines.length === 0 && polylines.length === 0 && arcs.length === 0 && circles.length === 0) {
    return undefined;
  }

  return { lines, polylines, arcs, circles };
}

function sanitizeImportDiagnostics(raw: unknown): ImportDiagnostics | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Partial<ImportDiagnostics>;
  return {
    wallCount: Math.max(0, Math.round(numberOr(obj.wallCount, 0))),
    windowCount: Math.max(0, Math.round(numberOr(obj.windowCount, 0))),
    seatCount: Math.max(0, Math.round(numberOr(obj.seatCount, 0))),
    rejectedSeats: Math.max(0, Math.round(numberOr(obj.rejectedSeats, 0))),
    notes: Array.isArray(obj.notes) ? obj.notes.filter((n): n is string => typeof n === 'string') : [],
  };
}

function ensureUniqueIds<T extends { id: string }>(items: T[], prefix: string): T[] {
  const used = new Set<string>();

  return items.map((item, index) => {
    const baseId = stringOr(item.id, `${prefix}-${index + 1}`);
    let candidate = baseId;
    let suffix = 2;

    while (used.has(candidate)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }

    used.add(candidate);
    return candidate === item.id ? item : { ...item, id: candidate };
  });
}

// ─── Environmental Calculation at a Seat Position ───────────────────────────

export interface SeatEnvironment {
  seatId: string;
  // Daylight
  distanceToNearestWindow: number; // meters
  nearestWindowOrientation: Orientation | null;
  estimatedIlluminance: number; // lux
  daylightFactor: number; // 0-1
  // Thermal
  distanceToExteriorWall: number; // meters
  nearestExteriorOrientation: Orientation | null;
  solarHeatGain: number; // estimated W/m²
  estimatedTemperature: number; // °C
  // Acoustic
  distanceToOpenArea: number; // meters (proxy for noise)
  estimatedNoise: number; // dB
  // Air Quality
  estimatedCO2: number; // ppm
  estimatedHumidity: number; // %
}

// City climate data (dry-hot climate like Riyadh)
const CITY_CLIMATE: Record<string, { baseTemp: number; humidity: number; co2Base: number }> = {
  'الرياض': { baseTemp: 26, humidity: 35, co2Base: 650 },
  'جدة': { baseTemp: 28, humidity: 55, co2Base: 620 },
  'الدمام': { baseTemp: 27, humidity: 50, co2Base: 630 },
  'أبوظبي': { baseTemp: 28, humidity: 55, co2Base: 640 },
  'دبي': { baseTemp: 28, humidity: 60, co2Base: 630 },
  'القاهرة': { baseTemp: 25, humidity: 45, co2Base: 680 },
  'بيروت': { baseTemp: 23, humidity: 65, co2Base: 600 },
  'عمّان': { baseTemp: 22, humidity: 50, co2Base: 590 },
  'default': { baseTemp: 25, humidity: 45, co2Base: 650 },
};

// Solar heat gain by orientation (W/m²) — simplified for dry-hot climate
const SOLAR_GAIN_BY_ORIENTATION: Record<Orientation, number> = {
  south: 380,
  west: 320,
  east: 280,
  north: 120,
};

// Glazing SHGC (Solar Heat Gain Coefficient) — lower = less heat
export const GLAZING_SHGC: Record<string, number> = {
  single: 0.86,
  double: 0.60,
  'low-e': 0.25,
  triple: 0.15,
};

// Glazing VLT (Visible Light Transmittance) — affects illuminance
export const GLAZING_VLT: Record<string, number> = {
  single: 0.90,
  double: 0.78,
  'low-e': 0.65,
  triple: 0.55,
};

// Illuminance falloff by distance from window
function estimateIlluminance(distanceMeters: number, orientation: Orientation | null): number {
  if (!orientation || distanceMeters > 9) return 180; // artificial only
  const baseAtWindow: Record<Orientation, number> = {
    south: 900, north: 500, east: 700, west: 650,
  };
  const base = baseAtWindow[orientation];
  // Inverse square falloff, clamped
  const lux = base / (1 + distanceMeters * 0.5);
  return Math.round(Math.max(180, Math.min(base, lux)));
}

function estimateTemperature(
  distanceToExterior: number,
  orientation: Orientation | null,
  baseTemp: number,
  glazingType: string = 'single'
): number {
  if (!orientation) return baseTemp;
  const solarGain = SOLAR_GAIN_BY_ORIENTATION[orientation];
  // Use SHGC directly: single=0.86, double=0.60, low-e=0.25, triple=0.15
  const shgc = GLAZING_SHGC[glazingType] ?? 0.86;
  // Heat contribution at wall surface (°C equivalent)
  const heatAtWall = (solarGain * shgc) / 60;
  // Exponential decay with distance from exterior wall
  const heatAtSeat = heatAtWall * Math.exp(-distanceToExterior * 0.35);
  return Math.round((baseTemp + heatAtSeat) * 10) / 10;
}

function estimateNoise(distanceToOpenArea: number, seatCount: number): number {
  // Base office noise ~45dB, increases with occupancy, decreases with distance
  const base = 45 + Math.min(10, seatCount * 0.5);
  const reduction = Math.min(12, distanceToOpenArea * 2);
  return Math.round(Math.max(30, base - reduction));
}

// Season-based outdoor temperature modifiers for Saudi cities
const SEASON_TEMP_MODIFIER: Record<string, number> = {
  summer: 8,   // +8°C above base
  autumn: 0,   // base
  winter: -8,  // -8°C below base
  spring: -2,  // slightly below base
};

// Hour-of-day solar intensity multiplier (0 at night, peak at noon)
function solarIntensityByHour(hour: number): number {
  if (hour < 6 || hour > 19) return 0;
  // Bell curve peaking at 12:30
  const peak = 12.5;
  const spread = 4.5;
  return Math.max(0, Math.exp(-Math.pow(hour - peak, 2) / (2 * spread * spread)));
}

export function calculateSeatEnvironment(
  seat: Seat,
  plan: FloorPlan,
  city: string,
  simulationDate?: Date
): SeatEnvironment {
  const climate = CITY_CLIMATE[city] ?? CITY_CLIMATE['default'];
  const scale = plan.scale; // px per meter

  // Find nearest window
  let minWindowDist = Infinity;
  let nearestWindow: Window | null = null;
  for (const w of plan.windows) {
    const dx = seat.x - w.x;
    const dy = seat.y - w.y;
    const dist = Math.sqrt(dx * dx + dy * dy) / scale;
    if (dist < minWindowDist) {
      minWindowDist = dist;
      nearestWindow = w;
    }
  }

  // Find nearest exterior wall
  let minExteriorDist = Infinity;
  let nearestExteriorWall: Wall | null = null;
  for (const w of plan.walls) {
    if (w.type !== 'exterior') continue;
    // Distance from point to line segment
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((seat.x - w.x1) * dx + (seat.y - w.y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = w.x1 + t * dx;
    const py = w.y1 + t * dy;
    const dist = Math.sqrt((seat.x - px) ** 2 + (seat.y - py) ** 2) / scale;
    if (dist < minExteriorDist) {
      minExteriorDist = dist;
      nearestExteriorWall = w;
    }
  }

  const nearestWindowOrientation = nearestWindow?.orientation ?? null;
  const nearestExteriorOrientation = nearestExteriorWall?.orientation ?? null;
  const glazingType = nearestWindow?.glazingType ?? 'single';

  // ─── Time & Season adjustments ───────────────────────────────────────────
  const hour = simulationDate ? simulationDate.getHours() : 10;
  const month = simulationDate ? simulationDate.getMonth() + 1 : 7;
  // Determine season from month
  const seasonKey: string =
    month >= 6 && month <= 8 ? 'summer' :
    month >= 9 && month <= 11 ? 'autumn' :
    month >= 3 && month <= 5 ? 'spring' : 'winter';
  const seasonTempMod = SEASON_TEMP_MODIFIER[seasonKey] ?? 0;
  const solarMult = solarIntensityByHour(hour);

  // Apply VLT to illuminance based on glazing type
  const vlt = GLAZING_VLT[glazingType] ?? 0.90;
  const rawIlluminance = estimateIlluminance(minWindowDist, nearestWindowOrientation);
  // Scale illuminance by time-of-day solar intensity — artificial base 180 lux always present
  const artificialBase = 180;
  const naturalLight = Math.round(rawIlluminance * (vlt / 0.90) * solarMult);
  const illuminance = Math.max(artificialBase, naturalLight);
  const daylightFactor = Math.min(1, illuminance / 500);

  // Temperature: base + season modifier + solar gain by time
  const adjustedBaseTemp = climate.baseTemp + seasonTempMod;
  const temperature = estimateTemperature(
    minExteriorDist,
    nearestExteriorOrientation,
    adjustedBaseTemp,
    glazingType
  );
  // Additional solar heat gain by time of day — stronger effect
  const timeSolarBoost = nearestExteriorOrientation
    ? SOLAR_GAIN_BY_ORIENTATION[nearestExteriorOrientation] * solarMult * 0.04
    : 0;
  const finalTemperature = Math.round((temperature + timeSolarBoost) * 10) / 10;

  const solarHeatGain = nearestExteriorOrientation
    ? Math.round(SOLAR_GAIN_BY_ORIENTATION[nearestExteriorOrientation] * solarMult)
    : 0;
  // Noise increases during work hours (9-12, 14-17)
  const noiseHourMod = (hour >= 9 && hour <= 12) || (hour >= 14 && hour <= 17) ? 5 : -3;
  const noise = estimateNoise(minWindowDist, plan.seats.length) + noiseHourMod;
  // CO2 increases with occupancy hours
  const co2HourMod = (hour >= 10 && hour <= 16) ? 80 : 20;
  const co2 = climate.co2Base + Math.max(0, (4 - minWindowDist) * 30) + co2HourMod;
  const humidity = climate.humidity;

  return {
    seatId: seat.id,
    distanceToNearestWindow: Math.round(minWindowDist * 10) / 10,
    nearestWindowOrientation,
    estimatedIlluminance: illuminance,
    daylightFactor,
    distanceToExteriorWall: Math.round(minExteriorDist * 10) / 10,
    nearestExteriorOrientation,
    solarHeatGain,
    estimatedTemperature: finalTemperature,
    distanceToOpenArea: Math.round(minWindowDist * 10) / 10,
    estimatedNoise: noise,
    estimatedCO2: Math.round(co2),
    estimatedHumidity: humidity,
  };
}

// ─── Default Floor Plan ──────────────────────────────────────────────────────

export function createDefaultFloorPlan(): FloorPlan {
  const W = 800;
  const H = 500;
  const scale = 50; // 50px = 1m → 16m × 10m office

  return {
    id: 'default',
    name: 'مكتب نموذجي',
    width: W,
    height: H,
    scale,
    city: 'الرياض',
    buildingOrientation: 0,
    walls: [
      // Exterior walls
      { id: 'w-north', x1: 50, y1: 50, x2: 750, y2: 50, type: 'exterior', orientation: 'north', thickness: 6 },
      { id: 'w-south', x1: 50, y1: 450, x2: 750, y2: 450, type: 'exterior', orientation: 'south', thickness: 6 },
      { id: 'w-east', x1: 750, y1: 50, x2: 750, y2: 450, type: 'exterior', orientation: 'east', thickness: 6 },
      { id: 'w-west', x1: 50, y1: 50, x2: 50, y2: 450, type: 'exterior', orientation: 'west', thickness: 6 },
      // Interior partition
      { id: 'w-int-1', x1: 400, y1: 50, x2: 400, y2: 250, type: 'interior', thickness: 4 },
    ],
    windows: [
      { id: 'win-1', wallId: 'w-south', x: 200, y: 450, width: 80, height: 10, orientation: 'south', glazingType: 'single' },
      { id: 'win-2', wallId: 'w-south', x: 500, y: 450, width: 80, height: 10, orientation: 'south', glazingType: 'single' },
      { id: 'win-3', wallId: 'w-north', x: 300, y: 50, width: 100, height: 10, orientation: 'north', glazingType: 'double' },
      { id: 'win-4', wallId: 'w-east', x: 750, y: 200, width: 10, height: 80, orientation: 'east', glazingType: 'single' },
    ],
    seats: [
      { id: 'seat-1', userId: null, x: 200, y: 200, label: 'مقعد 1' },
      { id: 'seat-2', userId: null, x: 300, y: 200, label: 'مقعد 2' },
      { id: 'seat-3', userId: null, x: 200, y: 320, label: 'مقعد 3' },
      { id: 'seat-4', userId: null, x: 550, y: 200, label: 'مقعد 4' },
      { id: 'seat-5', userId: null, x: 650, y: 300, label: 'مقعد 5' },
      { id: 'seat-6', userId: null, x: 550, y: 350, label: 'مقعد 6' },
    ],
  };
}

export function createDefaultAfterPlan(plan: FloorPlan): FloorPlan {
  return {
    ...plan,
    windows: plan.windows.map(w =>
      w.orientation === 'south' ? { ...w, glazingType: 'low-e' as const } : w
    ),
  };
}

export function normalizeFloorPlanImport(input: unknown): FloorPlan {
  const fallback = createDefaultFloorPlan();
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const walls = Array.isArray(raw.walls) && raw.walls.length > 0
    ? raw.walls.map((wall, index) => sanitizeWall(wall, index, fallback.walls[index % fallback.walls.length]))
    : fallback.walls;

  const windows = Array.isArray(raw.windows) && raw.windows.length > 0
    ? raw.windows.map((win, index) => sanitizeWindow(win, index, fallback.windows[index % fallback.windows.length]))
    : fallback.windows;

  const seats = Array.isArray(raw.seats) && raw.seats.length > 0
    ? raw.seats.map((seat, index) => sanitizeSeat(seat, index, fallback.seats[index % fallback.seats.length]))
    : fallback.seats;
  const uniqueWalls = ensureUniqueIds(walls, 'wall');
  const uniqueWindows = ensureUniqueIds(windows, 'win');
  const uniqueSeats = ensureUniqueIds(seats, 'seat');
  const cadGeometry = sanitizeCadGeometry(raw.cadGeometry);
  const importDiagnostics = sanitizeImportDiagnostics(raw.importDiagnostics);

  return {
    id: stringOr(raw.id, fallback.id),
    name: stringOr(raw.name, fallback.name),
    width: Math.max(100, numberOr(raw.width, fallback.width)),
    height: Math.max(100, numberOr(raw.height, fallback.height)),
    scale: Math.max(1, numberOr(raw.scale, fallback.scale)),
    walls: uniqueWalls,
    windows: uniqueWindows,
    seats: uniqueSeats,
    city: stringOr(raw.city, fallback.city),
    buildingOrientation: numberOr(raw.buildingOrientation, fallback.buildingOrientation),
    cadGeometry,
    importDiagnostics,
  };
}

// ─── WELL v2 Compliance Check ────────────────────────────────────────────────

export interface WellComplianceResult {
  illuminance: { pass: boolean; value: number; min: number; max: number };
  temperature: { pass: boolean; value: number; min: number; max: number };
  noise: { pass: boolean; value: number; min: number; max: number };
  co2: { pass: boolean; value: number; max: number };
  humidity: { pass: boolean; value: number; min: number; max: number };
  overallPass: boolean;
  score: number; // 0-100
}

export function checkWellCompliance(env: SeatEnvironment): WellComplianceResult {
  const illum = { pass: env.estimatedIlluminance >= 300 && env.estimatedIlluminance <= 750, value: env.estimatedIlluminance, min: 300, max: 750 };
  const temp = { pass: env.estimatedTemperature >= 20 && env.estimatedTemperature <= 26, value: env.estimatedTemperature, min: 20, max: 26 };
  const noise = { pass: env.estimatedNoise <= 50, value: env.estimatedNoise, min: 30, max: 50 };
  const co2 = { pass: env.estimatedCO2 <= 1000, value: env.estimatedCO2, max: 1000 };
  const humidity = { pass: env.estimatedHumidity >= 30 && env.estimatedHumidity <= 60, value: env.estimatedHumidity, min: 30, max: 60 };

  const passed = [illum.pass, temp.pass, noise.pass, co2.pass, humidity.pass].filter(Boolean).length;
  const score = Math.round((passed / 5) * 100);

  return { illuminance: illum, temperature: temp, noise, co2, humidity, overallPass: passed === 5, score };
}
