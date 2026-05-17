import {
  CadArc,
  CadCircle,
  CadGeometry,
  CadLine,
  CadPolyline,
  FloorPlan,
  ImportDiagnostics,
  Orientation,
  Seat,
  Wall,
  Window,
  createDefaultFloorPlan,
} from "@/lib/floorPlanEngine";

type DxfPair = {
  code: number;
  value: string;
};

type DxfEntity =
  | {
      type: "LINE";
      layer: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      type: "LWPOLYLINE";
      layer: string;
      closed: boolean;
      points: Array<{ x: number; y: number }>;
    }
  | {
      type: "ARC";
      layer: string;
      cx: number;
      cy: number;
      radius: number;
      startAngle: number;
      endAngle: number;
    }
  | {
      type: "CIRCLE";
      layer: string;
      cx: number;
      cy: number;
      radius: number;
    }
  | {
      type: "POINT";
      layer: string;
      x: number;
      y: number;
    }
  | {
      type: "INSERT";
      layer: string;
      blockName: string;
      x: number;
      y: number;
    };

type ParsedDxf = {
  units: number;
  entities: DxfEntity[];
};

type WorldSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string;
};

const LAYER_HINTS = {
  wall: /\b(wall|partition|boundary|exterior|outer|facade|column)\b/i,
  window: /window|glass|glazing|win\b/i,
  seat: /seat|desk|workstation|workplace|chair|cube|furn|furniture|i-furn/i,
};

const EXCLUDED_GEOMETRY_LAYERS = /text|anno|annotation|label|note|dim|dimension|hatch|symbol|title|grid|axis|elev|section/i;
const DW_LAYER_ONLY = /^dw$/i;
const WINDOW_LAYER_STRICT = /\b(window|windows|glass|glazing|win)\b/i;
const SEAT_NAME_HINTS = /chair|seat|desk|workstation|smile|setu|seating|task/i;
const SEAT_NAME_EXCLUDE = /d90|door|casework|shefat|compass|north|kitchen|kuzhina/i;

function parseNumber(value: string | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tokenizeDxf(text: string): DxfPair[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs: DxfPair[] = [];

  for (let i = 0; i < lines.length; i += 2) {
    const codeRaw = lines[i]?.trim();
    const value = lines[i + 1];
    if (codeRaw === undefined || value === undefined) break;

    const code = Number(codeRaw);
    if (!Number.isFinite(code)) continue;

    pairs.push({ code, value: value.trim() });
  }

  return pairs;
}

function parseHeaderUnits(pairs: DxfPair[]): number {
  let inHeader = false;
  let expectUnitsValue = false;
  let units = 0;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];

    if (pair.code === 0 && pair.value === "SECTION") {
      inHeader = pairs[i + 1]?.code === 2 && pairs[i + 1]?.value === "HEADER";
      expectUnitsValue = false;
      continue;
    }

    if (pair.code === 0 && pair.value === "ENDSEC") {
      if (inHeader) return units;
      inHeader = false;
      continue;
    }

    if (!inHeader) continue;

    if (pair.code === 9 && pair.value === "$INSUNITS") {
      expectUnitsValue = true;
      continue;
    }

    if (expectUnitsValue && pair.code === 70) {
      units = parseNumber(pair.value, 0);
      expectUnitsValue = false;
    }
  }

  return units;
}

function parseEntityPairs(pairs: DxfPair[], startIndex: number) {
  const type = pairs[startIndex]?.value ?? "";
  const entityPairs: DxfPair[] = [];
  let i = startIndex + 1;

  while (i < pairs.length) {
    const pair = pairs[i];
    if (pair.code === 0) break;
    entityPairs.push(pair);
    i += 1;
  }

  return { type, entityPairs, nextIndex: i };
}

function getFirstValue(entityPairs: DxfPair[], code: number) {
  return entityPairs.find(pair => pair.code === code)?.value;
}

function getAllValues(entityPairs: DxfPair[], code: number) {
  return entityPairs.filter(pair => pair.code === code).map(pair => pair.value);
}

function buildEntity(type: string, entityPairs: DxfPair[]): DxfEntity | null {
  const layer = getFirstValue(entityPairs, 8) ?? "0";

  if (type === "LINE") {
    return {
      type,
      layer,
      x1: parseNumber(getFirstValue(entityPairs, 10)),
      y1: parseNumber(getFirstValue(entityPairs, 20)),
      x2: parseNumber(getFirstValue(entityPairs, 11)),
      y2: parseNumber(getFirstValue(entityPairs, 21)),
    };
  }

  if (type === "LWPOLYLINE") {
    const xValues = getAllValues(entityPairs, 10);
    const yValues = getAllValues(entityPairs, 20);
    const count = Math.min(xValues.length, yValues.length);
    const points = Array.from({ length: count }, (_, index) => ({
      x: parseNumber(xValues[index]),
      y: parseNumber(yValues[index]),
    }));
    const flags = parseNumber(getFirstValue(entityPairs, 70), 0);

    return {
      type,
      layer,
      closed: Boolean(flags & 1),
      points,
    };
  }

  if (type === "ARC") {
    return {
      type,
      layer,
      cx: parseNumber(getFirstValue(entityPairs, 10)),
      cy: parseNumber(getFirstValue(entityPairs, 20)),
      radius: Math.abs(parseNumber(getFirstValue(entityPairs, 40))),
      startAngle: parseNumber(getFirstValue(entityPairs, 50)),
      endAngle: parseNumber(getFirstValue(entityPairs, 51)),
    };
  }

  if (type === "CIRCLE") {
    return {
      type,
      layer,
      cx: parseNumber(getFirstValue(entityPairs, 10)),
      cy: parseNumber(getFirstValue(entityPairs, 20)),
      radius: Math.abs(parseNumber(getFirstValue(entityPairs, 40))),
    };
  }

  if (type === "POINT") {
    return {
      type,
      layer,
      x: parseNumber(getFirstValue(entityPairs, 10)),
      y: parseNumber(getFirstValue(entityPairs, 20)),
    };
  }

  if (type === "INSERT") {
    return {
      type,
      layer,
      blockName: getFirstValue(entityPairs, 2) ?? "",
      x: parseNumber(getFirstValue(entityPairs, 10)),
      y: parseNumber(getFirstValue(entityPairs, 20)),
    };
  }

  return null;
}

function parseDxf(text: string): ParsedDxf {
  const pairs = tokenizeDxf(text);
  const units = parseHeaderUnits(pairs);
  const entities: DxfEntity[] = [];

  let i = 0;
  while (i < pairs.length) {
    const pair = pairs[i];

    if (pair.code === 0 && pair.value === "SECTION") {
      const sectionName = pairs[i + 1]?.code === 2 ? pairs[i + 1]?.value : "";
      i += 2;

      if (sectionName === "ENTITIES") {
        while (i < pairs.length) {
          if (pairs[i].code === 0 && pairs[i].value === "ENDSEC") {
            i += 1;
            break;
          }

          if (pairs[i].code === 0) {
            const { type, entityPairs, nextIndex } = parseEntityPairs(pairs, i);
            const entity = buildEntity(type, entityPairs);
            if (entity) entities.push(entity);
            i = nextIndex;
            continue;
          }

          i += 1;
        }
        continue;
      }

      while (i < pairs.length && !(pairs[i].code === 0 && pairs[i].value === "ENDSEC")) {
        i += 1;
      }
      i += 1;
      continue;
    }

    i += 1;
  }

  return { units, entities };
}

function unitsToMetersFactor(units: number) {
  switch (units) {
    case 1:
      return 0.0254; // inches
    case 2:
      return 0.3048; // feet
    case 4:
      return 0.001; // millimeters
    case 5:
      return 0.01; // centimeters
    case 6:
      return 1; // meters
    default:
      return 1;
  }
}

function toCanvasPoint(
  xMeters: number,
  yMeters: number,
  layout: { minX: number; maxY: number; offsetX: number; offsetY: number; scale: number }
) {
  return {
    x: Math.round(layout.offsetX + (xMeters - layout.minX) * layout.scale),
    y: Math.round(layout.offsetY + (layout.maxY - yMeters) * layout.scale),
  };
}

function fitScaleToCanvas(
  spanX: number,
  spanY: number,
  canvasWidth: number,
  canvasHeight: number,
  margin: number
) {
  const safeSpanX = Math.max(spanX, 0.001);
  const safeSpanY = Math.max(spanY, 0.001);
  const scaleX = (canvasWidth - margin * 2) / safeSpanX;
  const scaleY = (canvasHeight - margin * 2) / safeSpanY;
  return Math.max(0.01, Math.min(scaleX, scaleY));
}

function segmentLengthMeters(segment: { x1: number; y1: number; x2: number; y2: number }) {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
}

function segmentIsMostlyAxisAligned(segment: WorldSegment) {
  const dx = Math.abs(segment.x2 - segment.x1);
  const dy = Math.abs(segment.y2 - segment.y1);
  return dx < 0.08 || dy < 0.08;
}

function orientationForEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  tolerance: number
): Orientation | null {
  const horizontal = Math.abs(y2 - y1) <= Math.abs(x2 - x1);
  const vertical = !horizontal;

  if (horizontal) {
    if (Math.abs(y1 - bounds.maxY) <= tolerance && Math.abs(y2 - bounds.maxY) <= tolerance) return "north";
    if (Math.abs(y1 - bounds.minY) <= tolerance && Math.abs(y2 - bounds.minY) <= tolerance) return "south";
  }

  if (vertical) {
    if (Math.abs(x1 - bounds.maxX) <= tolerance && Math.abs(x2 - bounds.maxX) <= tolerance) return "east";
    if (Math.abs(x1 - bounds.minX) <= tolerance && Math.abs(x2 - bounds.minX) <= tolerance) return "west";
  }

  return null;
}

function createWallFromSegment(
  segment: WorldSegment,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  layout: { minX: number; maxY: number; offsetX: number; offsetY: number; scale: number },
  index: number
): Wall {
  const tolerance = Math.max(0.15, 0.01 * Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY));
  const orientation = orientationForEdge(segment.x1, segment.y1, segment.x2, segment.y2, bounds, tolerance);
  const start = toCanvasPoint(segment.x1, segment.y1, layout);
  const end = toCanvasPoint(segment.x2, segment.y2, layout);

  return {
    id: `wall-${index + 1}`,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    type: orientation ? "exterior" : "interior",
    orientation: orientation ?? undefined,
    thickness: orientation ? 6 : 4,
  };
}

function isHighConfidenceDwWindow(
  segment: WorldSegment,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  span: number
) {
  if (!DW_LAYER_ONLY.test(segment.layer)) return false;
  const length = segmentLengthMeters(segment);
  if (length < 0.8 || length > Math.max(4.5, span * 0.28)) return false;

  const tolerance = Math.max(0.18, span * 0.012);
  const orientation = orientationForEdge(segment.x1, segment.y1, segment.x2, segment.y2, bounds, tolerance);
  return Boolean(orientation);
}

function createWindowFromSegment(
  segment: WorldSegment,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  layout: { minX: number; maxY: number; offsetX: number; offsetY: number; scale: number },
  wallId: string,
  index: number
): Window {
  const start = toCanvasPoint(segment.x1, segment.y1, layout);
  const end = toCanvasPoint(segment.x2, segment.y2, layout);
  const horizontal = Math.abs(segment.y2 - segment.y1) <= Math.abs(segment.x2 - segment.x1);

  return {
    id: `win-${index + 1}`,
    wallId,
    x: Math.round((start.x + end.x) / 2),
    y: Math.round((start.y + end.y) / 2),
    width: horizontal ? Math.max(12, Math.abs(end.x - start.x)) : 10,
    height: horizontal ? 10 : Math.max(12, Math.abs(end.y - start.y)),
    orientation: orientationForEdge(segment.x1, segment.y1, segment.x2, segment.y2, bounds, 0.25) ?? "south",
    glazingType: "single",
  };
}

function dedupeWindows(windows: Window[]) {
  const kept: Window[] = [];
  for (const windowItem of windows) {
    const duplicate = kept.some(existing => Math.hypot(existing.x - windowItem.x, existing.y - windowItem.y) < 24);
    if (!duplicate) kept.push(windowItem);
  }
  return kept;
}

function createSeatGrid(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  layout: { minX: number; maxY: number; offsetX: number; offsetY: number; scale: number },
  count: number
): Seat[] {
  const usableWidth = Math.max(2, bounds.maxX - bounds.minX);
  const usableHeight = Math.max(2, bounds.maxY - bounds.minY);
  const cols = count > 4 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(count / cols));
  const seats: Seat[] = [];
  const xSteps = cols + 1;
  const ySteps = rows + 1;

  for (let index = 0; index < count; index++) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const xMeters = bounds.minX + (usableWidth * (col + 1)) / xSteps;
    const yMeters = bounds.maxY - (usableHeight * (row + 1)) / ySteps;
    const point = toCanvasPoint(xMeters, yMeters, layout);

    seats.push({
      id: `seat-${index + 1}`,
      userId: null,
      x: point.x,
      y: point.y,
      label: ` ${index + 1}`,
    });
  }

  return seats;
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, layer: string): CadArc {
  return { cx, cy, r: Math.max(0, radius), startAngle, endAngle, layer };
}

function buildCadGeometry(
  parsed: ParsedDxf,
  factor: number,
  layout: { minX: number; maxY: number; offsetX: number; offsetY: number; scale: number }
): CadGeometry {
  const lines: CadLine[] = [];
  const polylines: CadPolyline[] = [];
  const arcs: CadArc[] = [];
  const circles: CadCircle[] = [];

  parsed.entities.forEach((entity) => {
    if (EXCLUDED_GEOMETRY_LAYERS.test(entity.layer)) return;

    if (entity.type === "LINE") {
      const p1 = toCanvasPoint(entity.x1 * factor, entity.y1 * factor, layout);
      const p2 = toCanvasPoint(entity.x2 * factor, entity.y2 * factor, layout);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, layer: entity.layer });
      return;
    }

    if (entity.type === "LWPOLYLINE" && entity.points.length > 1) {
      const points = entity.points.map((point) => toCanvasPoint(point.x * factor, point.y * factor, layout));
      polylines.push({
        points,
        closed: entity.closed,
        layer: entity.layer,
      });
      return;
    }

    if (entity.type === "ARC") {
      const center = toCanvasPoint(entity.cx * factor, entity.cy * factor, layout);
      arcs.push(arcPath(center.x, center.y, entity.radius * factor * layout.scale, entity.startAngle, entity.endAngle, entity.layer));
      return;
    }

    if (entity.type === "CIRCLE") {
      const center = toCanvasPoint(entity.cx * factor, entity.cy * factor, layout);
      circles.push({
        cx: center.x,
        cy: center.y,
        r: entity.radius * factor * layout.scale,
        layer: entity.layer,
      });
    }
  });

  return { lines, polylines, arcs, circles };
}

function clampSeatToCanvas(seat: Seat, width: number, height: number) {
  return {
    ...seat,
    x: Math.max(24, Math.min(width - 24, seat.x)),
    y: Math.max(24, Math.min(height - 24, seat.y)),
  };
}

export function parseDxfFloorPlan(text: string, fileName = "imported-dxf"): FloorPlan {
  const parsed = parseDxf(text);
  const factor = unitsToMetersFactor(parsed.units);

  const segments: WorldSegment[] = parsed.entities.flatMap(entity => {
    if (entity.type === "LINE") {
      return [{
        x1: entity.x1 * factor,
        y1: entity.y1 * factor,
        x2: entity.x2 * factor,
        y2: entity.y2 * factor,
        layer: entity.layer,
      }];
    }

    if (entity.type === "LWPOLYLINE" && entity.points.length > 1) {
      const points = entity.points.map(point => ({
        x: point.x * factor,
        y: point.y * factor,
      }));

      const result = points.slice(1).map((point, index) => ({
        x1: points[index].x,
        y1: points[index].y,
        x2: point.x,
        y2: point.y,
        layer: entity.layer,
      }));

      if (entity.closed) {
        const first = points[0];
        const last = points[points.length - 1];
        result.push({
          x1: last.x,
          y1: last.y,
          x2: first.x,
          y2: first.y,
          layer: entity.layer,
        });
      }

      return result;
    }

    return [];
  });

  if (segments.length === 0) {
    return createDefaultFloorPlan();
  }

  const xs = segments.flatMap(segment => [segment.x1, segment.x2]);
  const ys = segments.flatMap(segment => [segment.y1, segment.y2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bounds = { minX, maxX, minY, maxY };

  const canvasWidth = 1200;
  const canvasHeight = 800;
  const margin = 80;
  const scale = fitScaleToCanvas(maxX - minX, maxY - minY, canvasWidth, canvasHeight, margin);
  const layout = {
    minX,
    maxY,
    offsetX: Math.max(margin, Math.round((canvasWidth - (maxX - minX) * scale) / 2)),
    offsetY: Math.max(margin, Math.round((canvasHeight - (maxY - minY) * scale) / 2)),
    scale,
  };

  const span = Math.max(maxX - minX, maxY - minY);
  const minWallLengthMeters = Math.max(0.35, span * 0.012);
  const explicitWallSegments = segments.filter((segment) => {
    if (EXCLUDED_GEOMETRY_LAYERS.test(segment.layer)) return false;
    if (!LAYER_HINTS.wall.test(segment.layer)) return false;
    return segmentLengthMeters(segment) >= Math.max(0.2, minWallLengthMeters * 0.5);
  });

  const structuralCandidates = segments.filter((segment) => {
    if (EXCLUDED_GEOMETRY_LAYERS.test(segment.layer)) return false;
    if (LAYER_HINTS.window.test(segment.layer)) return false;
    if (DW_LAYER_ONLY.test(segment.layer)) return false;
    if (LAYER_HINTS.seat.test(segment.layer)) return false;
    if (!segmentIsMostlyAxisAligned(segment)) return false;
    return segmentLengthMeters(segment) >= minWallLengthMeters;
  });

  const wallSegments = explicitWallSegments.length > 0 ? explicitWallSegments : structuralCandidates;
  if (wallSegments.length === 0) {
    return createDefaultFloorPlan();
  }

  const walls = wallSegments.map((segment, index) => createWallFromSegment(segment, bounds, layout, index));
  const exteriorWalls = walls.filter(wall => wall.type === "exterior");

  const strictWindowSegments = segments.filter((segment) => {
    if (EXCLUDED_GEOMETRY_LAYERS.test(segment.layer)) return false;
    if (!WINDOW_LAYER_STRICT.test(segment.layer)) return false;
    return segmentLengthMeters(segment) >= Math.max(0.4, minWallLengthMeters * 0.55);
  });
  const perimeterDwWindows = segments.filter((segment) => {
    if (EXCLUDED_GEOMETRY_LAYERS.test(segment.layer)) return false;
    return isHighConfidenceDwWindow(segment, bounds, span);
  });

  const windowSegments = [...strictWindowSegments, ...perimeterDwWindows];
  const windowsRaw = windowSegments.map((segment, index) => {
    const orientation = orientationForEdge(segment.x1, segment.y1, segment.x2, segment.y2, bounds, 0.25) ?? "south";
    const matchingWall = exteriorWalls.find(wall => wall.orientation === orientation) ?? exteriorWalls[0];
    return createWindowFromSegment(segment, bounds, layout, matchingWall?.id ?? "wall-1", index);
  });
  const windows = dedupeWindows(windowsRaw);

  const insertEntities = parsed.entities.filter((entity): entity is Extract<DxfEntity, { type: "INSERT" }> => entity.type === "INSERT");
  const anonymousCounts = insertEntities.reduce<Record<string, number>>((acc, entity) => {
    const key = entity.blockName || "";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const seatCandidates = insertEntities.filter((entity) => {
    const layer = entity.layer.toLowerCase();
    const name = entity.blockName.toLowerCase();
    if (SEAT_NAME_EXCLUDE.test(name)) return false;

    const namedSeat = SEAT_NAME_HINTS.test(name) && !DW_LAYER_ONLY.test(layer);
    const layerSeat = /i-furn|furniture/.test(layer) && !DW_LAYER_ONLY.test(layer);
    const repeatedAnonymous = name.startsWith("a$c") && (anonymousCounts[entity.blockName] ?? 0) >= 6 && layer !== "dw";
    return namedSeat || layerSeat || repeatedAnonymous;
  });

  const mappedSeats = seatCandidates.map((entity, index) => {
    const point = toCanvasPoint(entity.x * factor, entity.y * factor, layout);
    return {
      id: `seat-${index + 1}`,
      userId: null,
      x: point.x,
      y: point.y,
      label: ` ${index + 1}`,
    } satisfies Seat;
  });

  const dedupedSeats: Seat[] = [];
  mappedSeats.forEach((seat) => {
    const duplicate = dedupedSeats.some(existing => Math.hypot(existing.x - seat.x, existing.y - seat.y) < 18);
    if (!duplicate) dedupedSeats.push(seat);
  });

  let rejectedSeats = 0;
  const visibleSeats = dedupedSeats
    .filter((seat) => {
      const keep =
        seat.x >= margin &&
        seat.x <= canvasWidth - margin &&
        seat.y >= margin &&
        seat.y <= canvasHeight - margin;
      if (!keep) rejectedSeats += 1;
      return keep;
    })
    .map((seat) => clampSeatToCanvas(seat, canvasWidth, canvasHeight));

  const fallbackSeats = createSeatGrid(bounds, layout, 6);
  const seats = visibleSeats.length >= 3 ? visibleSeats : fallbackSeats;

  const notes: string[] = [];
  if (visibleSeats.length < 3) {
    notes.push("Seat extraction confidence was low, using guided fallback seat grid.");
  }
  if (perimeterDwWindows.length > 0) {
    notes.push("DW layer interpreted conservatively: only perimeter-aligned segments became windows.");
  }

  const cadGeometry = buildCadGeometry(parsed, factor, layout);
  const importDiagnostics: ImportDiagnostics = {
    wallCount: walls.length,
    windowCount: windows.length,
    seatCount: seats.length,
    rejectedSeats,
    notes,
  };

  return {
    ...createDefaultFloorPlan(),
    id: fileName.replace(/\.[^.]+$/, "") || "dxf-import",
    name: fileName.replace(/\.[^.]+$/, "") || "Imported DXF",
    width: canvasWidth,
    height: canvasHeight,
    scale,
    walls,
    windows,
    seats,
    cadGeometry,
    importDiagnostics,
  };
}
