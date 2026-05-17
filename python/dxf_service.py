from __future__ import annotations

import base64
import io
import math
import os
import tempfile
from dataclasses import dataclass
from typing import Any, Iterable

import ezdxf
from ezdxf import bbox, recover
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 800
CANVAS_MARGIN = 80

ORIENTATION_HINTS = {"north", "south", "east", "west"}
EXCLUDED_LAYERS = (
    "text",
    "anno",
    "annotation",
    "label",
    "note",
    "dim",
    "dimension",
    "hatch",
    "symbol",
    "title",
    "grid",
    "axis",
    "elev",
    "section",
)


class ConvertRequest(BaseModel):
    dxfText: str | None = None
    dxfBase64: str | None = None
    fileName: str = "imported.dxf"


@dataclass
class Segment:
    x1: float
    y1: float
    x2: float
    y2: float
    layer: str


@dataclass
class ArcPrimitive:
    cx: float
    cy: float
    r: float
    start_angle: float
    end_angle: float
    layer: str


@dataclass
class CirclePrimitive:
    cx: float
    cy: float
    r: float
    layer: str


@dataclass
class PolylinePrimitive:
    points: list[tuple[float, float]]
    closed: bool
    layer: str


app = FastAPI(title="DXF conversion service", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _unit_factor(units: int | None) -> float:
    mapping = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0}
    return mapping.get(units or 0, 1.0)


def _segment_length(seg: Segment) -> float:
    return math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)


def _fit_scale(span_x: float, span_y: float) -> float:
    safe_x = max(span_x, 0.001)
    safe_y = max(span_y, 0.001)
    sx = (CANVAS_WIDTH - CANVAS_MARGIN * 2) / safe_x
    sy = (CANVAS_HEIGHT - CANVAS_MARGIN * 2) / safe_y
    return max(0.01, min(sx, sy))


def _to_canvas(
    x: float,
    y: float,
    min_x: float,
    max_y: float,
    scale: float,
    offset_x: float,
    offset_y: float,
) -> tuple[int, int]:
    px = round(offset_x + (x - min_x) * scale)
    py = round(offset_y + (max_y - y) * scale)
    return px, py


def _orientation(seg: Segment, bounds: dict[str, float], tol: float) -> str | None:
    horizontal = abs(seg.y2 - seg.y1) <= abs(seg.x2 - seg.x1)
    vertical = not horizontal
    if horizontal:
        if abs(seg.y1 - bounds["maxY"]) <= tol and abs(seg.y2 - bounds["maxY"]) <= tol:
            return "north"
        if abs(seg.y1 - bounds["minY"]) <= tol and abs(seg.y2 - bounds["minY"]) <= tol:
            return "south"
    if vertical:
        if abs(seg.x1 - bounds["maxX"]) <= tol and abs(seg.x2 - bounds["maxX"]) <= tol:
            return "east"
        if abs(seg.x1 - bounds["minX"]) <= tol and abs(seg.x2 - bounds["minX"]) <= tol:
            return "west"
    return None


def _normalize_name(file_name: str) -> str:
    if "." in file_name:
        return file_name.rsplit(".", 1)[0]
    return file_name or "imported-dxf"


def _is_axis_aligned(seg: Segment) -> bool:
    return abs(seg.x2 - seg.x1) < 0.08 or abs(seg.y2 - seg.y1) < 0.08


def _is_perimeter_dw_window(seg: Segment, bounds: dict[str, float], span: float) -> bool:
    if (seg.layer or "").strip().lower() != "dw":
        return False
    length = _segment_length(seg)
    if length < 0.8 or length > max(4.5, span * 0.28):
        return False
    tol = max(0.18, span * 0.012)
    return _orientation(seg, bounds, tol) in ORIENTATION_HINTS


def _dedupe_windows(windows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    for item in windows:
        duplicate = any(math.hypot(prev["x"] - item["x"], prev["y"] - item["y"]) < 24 for prev in deduped)
        if not duplicate:
            deduped.append(item)
    return deduped


def _clamp_seat(x: int, y: int) -> tuple[int, int]:
    return (
        max(24, min(CANVAS_WIDTH - 24, x)),
        max(24, min(CANVAS_HEIGHT - 24, y)),
    )


def _iter_lines_from_entity(entity: Any) -> Iterable[Segment]:
    layer = str(getattr(entity.dxf, "layer", "0"))
    etype = entity.dxftype()

    if etype == "LINE":
        start = entity.dxf.start
        end = entity.dxf.end
        yield Segment(start.x, start.y, end.x, end.y, layer)
        return

    if etype in {"LWPOLYLINE", "POLYLINE"}:
        points: list[tuple[float, float]] = []
        if etype == "LWPOLYLINE":
            points = [(p[0], p[1]) for p in entity.get_points("xy")]
            closed = bool(entity.closed)
        else:
            points = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            closed = bool(getattr(entity, "is_closed", False))

        for i in range(1, len(points)):
            x1, y1 = points[i - 1]
            x2, y2 = points[i]
            yield Segment(x1, y1, x2, y2, layer)
        if closed and len(points) > 2:
            x1, y1 = points[-1]
            x2, y2 = points[0]
            yield Segment(x1, y1, x2, y2, layer)
        return

    if etype == "ARC":
        center = entity.dxf.center
        radius = float(entity.dxf.radius)
        start_deg = float(entity.dxf.start_angle)
        end_deg = float(entity.dxf.end_angle)
        if end_deg < start_deg:
            end_deg += 360.0
        steps = max(8, int((end_deg - start_deg) / 10.0))
        pts: list[tuple[float, float]] = []
        for i in range(steps + 1):
            t = start_deg + (end_deg - start_deg) * (i / steps)
            rad = math.radians(t)
            pts.append((center.x + radius * math.cos(rad), center.y + radius * math.sin(rad)))
        for i in range(1, len(pts)):
            x1, y1 = pts[i - 1]
            x2, y2 = pts[i]
            yield Segment(x1, y1, x2, y2, layer)
        return

    if etype == "CIRCLE":
        center = entity.dxf.center
        radius = float(entity.dxf.radius)
        steps = 36
        pts = []
        for i in range(steps + 1):
            rad = math.radians(i * (360.0 / steps))
            pts.append((center.x + radius * math.cos(rad), center.y + radius * math.sin(rad)))
        for i in range(1, len(pts)):
            x1, y1 = pts[i - 1]
            x2, y2 = pts[i]
            yield Segment(x1, y1, x2, y2, layer)
        return


def _extract_geometry(doc: Any, factor: float) -> dict[str, Any]:
    msp = doc.modelspace()
    segments: list[Segment] = []
    lines: list[dict[str, Any]] = []
    polylines: list[dict[str, Any]] = []
    arcs: list[dict[str, Any]] = []
    circles: list[dict[str, Any]] = []

    def walk_entity(entity: Any, depth: int = 0) -> None:
        if depth > 5:
            return
        try:
            etype = entity.dxftype()
            layer = str(getattr(entity.dxf, "layer", "0"))

            if etype == "INSERT":
                try:
                    for nested in entity.virtual_entities():
                        walk_entity(nested, depth + 1)
                except Exception:
                    return
                return

            if etype == "LINE":
                start = entity.dxf.start
                end = entity.dxf.end
                line = {
                    "x1": float(start.x) * factor,
                    "y1": float(start.y) * factor,
                    "x2": float(end.x) * factor,
                    "y2": float(end.y) * factor,
                    "layer": layer,
                }
                lines.append(line)
                segments.append(Segment(line["x1"], line["y1"], line["x2"], line["y2"], layer))
                return

            if etype in {"LWPOLYLINE", "POLYLINE"}:
                points: list[tuple[float, float]] = []
                if etype == "LWPOLYLINE":
                    points = [(float(p[0]) * factor, float(p[1]) * factor) for p in entity.get_points("xy")]
                    closed = bool(entity.closed)
                else:
                    points = [(float(v.dxf.location.x) * factor, float(v.dxf.location.y) * factor) for v in entity.vertices]
                    closed = bool(getattr(entity, "is_closed", False))

                if len(points) >= 2:
                    polylines.append({"points": [{"x": x, "y": y} for (x, y) in points], "closed": closed, "layer": layer})
                    for i in range(1, len(points)):
                        x1, y1 = points[i - 1]
                        x2, y2 = points[i]
                        segments.append(Segment(x1, y1, x2, y2, layer))
                    if closed and len(points) > 2:
                        x1, y1 = points[-1]
                        x2, y2 = points[0]
                        segments.append(Segment(x1, y1, x2, y2, layer))
                return

            if etype == "ARC":
                center = entity.dxf.center
                arcs.append(
                    {
                        "cx": float(center.x) * factor,
                        "cy": float(center.y) * factor,
                        "r": abs(float(entity.dxf.radius) * factor),
                        "startAngle": float(entity.dxf.start_angle),
                        "endAngle": float(entity.dxf.end_angle),
                        "layer": layer,
                    }
                )
                for seg in _iter_lines_from_entity(entity):
                    segments.append(Segment(seg.x1 * factor, seg.y1 * factor, seg.x2 * factor, seg.y2 * factor, layer))
                return

            if etype == "CIRCLE":
                center = entity.dxf.center
                circles.append(
                    {
                        "cx": float(center.x) * factor,
                        "cy": float(center.y) * factor,
                        "r": abs(float(entity.dxf.radius) * factor),
                        "layer": layer,
                    }
                )
                for seg in _iter_lines_from_entity(entity):
                    segments.append(Segment(seg.x1 * factor, seg.y1 * factor, seg.x2 * factor, seg.y2 * factor, layer))
                return
        except Exception:
            return

    for entity in msp:
        walk_entity(entity, 0)

    return {
        "segments": segments,
        "cad_world": {
            "lines": lines,
            "polylines": polylines,
            "arcs": arcs,
            "circles": circles,
        },
    }


def _extract_seat_points_from_doc(doc: Any, factor: float) -> tuple[list[tuple[float, float]], list[str]]:
    msp = doc.modelspace()
    points: list[tuple[float, float]] = []
    notes: list[str] = []
    inserts = [e for e in msp if e.dxftype() == "INSERT"]
    name_counts: dict[str, int] = {}
    for ins in inserts:
        name = str(getattr(ins.dxf, "name", "")).strip()
        name_counts[name] = name_counts.get(name, 0) + 1

    excluded_name_tokens = ("d90", "door", "casework", "shefat", "compass", "north", "kuzhina", "trp14")
    seat_name_tokens = ("chair", "seat", "desk", "workstation", "smile", "setu", "seating")

    def block_is_reasonable_chair_size(entity: Any) -> bool:
        try:
            virtuals = list(entity.virtual_entities())
            if not virtuals:
                return True
            bb = bbox.extents(virtuals)
            width = abs(float(bb.extmax.x) - float(bb.extmin.x)) * factor
            height = abs(float(bb.extmax.y) - float(bb.extmin.y)) * factor
            if width < 0.2 or height < 0.2:
                return False
            if width > 2.8 or height > 2.8:
                return False
            return True
        except Exception:
            return True

    for entity in inserts:
        layer = str(getattr(entity.dxf, "layer", "")).strip().lower()
        name_raw = str(getattr(entity.dxf, "name", "")).strip()
        name = name_raw.lower()
        if any(t in name for t in excluded_name_tokens):
            continue
        if layer == "dw":
            continue

        named_seat = any(t in name for t in seat_name_tokens)
        layer_seat = layer in {"i-furn", "furniture"}
        repeated_anonymous = name.startswith("a$c") and name_counts.get(name_raw, 0) >= 6 and layer in {"0", "i-furn", "furniture"}

        if not (named_seat or layer_seat or repeated_anonymous):
            continue
        if not block_is_reasonable_chair_size(entity):
            continue
        try:
            x = float(entity.dxf.insert.x) * factor
            y = float(entity.dxf.insert.y) * factor
            points.append((x, y))
        except Exception:
            continue

    deduped: list[tuple[float, float]] = []
    for x, y in points:
        if any(math.hypot(x - px, y - py) < 0.22 for px, py in deduped):
            continue
        deduped.append((x, y))

    if len(deduped) < 3:
        notes.append("Seat extraction confidence low; fallback seat grid may be used.")

    return deduped, notes


def _world_geometry_to_canvas(cad_world: dict[str, Any], layout: dict[str, float]) -> dict[str, Any]:
    lines: list[dict[str, Any]] = []
    polylines: list[dict[str, Any]] = []
    arcs: list[dict[str, Any]] = []
    circles: list[dict[str, Any]] = []

    for line in cad_world.get("lines", []):
        sx, sy = _to_canvas(line["x1"], line["y1"], layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        ex, ey = _to_canvas(line["x2"], line["y2"], layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        lines.append({"x1": sx, "y1": sy, "x2": ex, "y2": ey, "layer": line.get("layer")})

    for poly in cad_world.get("polylines", []):
        points = []
        for pt in poly.get("points", []):
            x, y = _to_canvas(pt["x"], pt["y"], layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
            points.append({"x": x, "y": y})
        if len(points) >= 2:
            polylines.append({"points": points, "closed": bool(poly.get("closed")), "layer": poly.get("layer")})

    for arc in cad_world.get("arcs", []):
        cx, cy = _to_canvas(arc["cx"], arc["cy"], layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        arcs.append(
            {
                "cx": cx,
                "cy": cy,
                "r": arc["r"] * layout["scale"],
                "startAngle": arc["startAngle"],
                "endAngle": arc["endAngle"],
                "layer": arc.get("layer"),
            }
        )

    for circle in cad_world.get("circles", []):
        cx, cy = _to_canvas(circle["cx"], circle["cy"], layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        circles.append({"cx": cx, "cy": cy, "r": circle["r"] * layout["scale"], "layer": circle.get("layer")})

    return {"lines": lines, "polylines": polylines, "arcs": arcs, "circles": circles}


def _create_seat_grid(bounds: dict[str, float], layout: dict[str, float], count: int = 6) -> list[dict[str, Any]]:
    usable_width = max(2.0, bounds["maxX"] - bounds["minX"])
    usable_height = max(2.0, bounds["maxY"] - bounds["minY"])
    cols = 3 if count > 4 else 2
    rows = max(1, math.ceil(count / cols))
    seats: list[dict[str, Any]] = []

    for idx in range(count):
        col = idx % cols
        row = idx // cols
        x = bounds["minX"] + (usable_width * (col + 1)) / (cols + 1)
        y = bounds["maxY"] - (usable_height * (row + 1)) / (rows + 1)
        sx, sy = _to_canvas(x, y, layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        sx, sy = _clamp_seat(sx, sy)
        seats.append({"id": f"seat-{idx+1}", "userId": None, "x": sx, "y": sy, "label": f"Seat {idx+1}"})
    return seats


def _segments_to_plan(
    segments: list[Segment],
    file_name: str,
    seat_points_m: list[tuple[float, float]] | None = None,
    cad_world: dict[str, Any] | None = None,
    extra_notes: list[str] | None = None,
) -> dict[str, Any]:
    if not segments:
        raise HTTPException(status_code=400, detail="No drawable geometry found in DXF modelspace.")

    xs = [p for seg in segments for p in (seg.x1, seg.x2)]
    ys = [p for seg in segments for p in (seg.y1, seg.y2)]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    bounds = {"minX": min_x, "maxX": max_x, "minY": min_y, "maxY": max_y}

    span = max(max_x - min_x, max_y - min_y)
    min_len = max(0.35, span * 0.012)

    def layer_lc(seg: Segment) -> str:
        return (seg.layer or "").strip().lower()

    explicit_walls = [
        s
        for s in segments
        if (
            ("wall" in layer_lc(s) or "column" in layer_lc(s))
            and not any(k in layer_lc(s) for k in EXCLUDED_LAYERS)
            and _segment_length(s) >= max(0.2, min_len * 0.5)
        )
    ]
    candidate_walls = [
        s
        for s in segments
        if _segment_length(s) >= min_len
        and _is_axis_aligned(s)
        and not any(k in layer_lc(s) for k in EXCLUDED_LAYERS)
        and "window" not in layer_lc(s)
        and "glass" not in layer_lc(s)
        and "glazing" not in layer_lc(s)
        and layer_lc(s) != "dw"
        and "furn" not in layer_lc(s)
    ]
    wall_segments = explicit_walls if explicit_walls else candidate_walls
    if not wall_segments:
        wall_segments = [s for s in segments if _segment_length(s) >= max(0.1, min_len * 0.35)]

    scale = _fit_scale(max_x - min_x, max_y - min_y)
    offset_x = max(CANVAS_MARGIN, round((CANVAS_WIDTH - (max_x - min_x) * scale) / 2))
    offset_y = max(CANVAS_MARGIN, round((CANVAS_HEIGHT - (max_y - min_y) * scale) / 2))
    layout = {"minX": min_x, "maxY": max_y, "scale": scale, "offsetX": offset_x, "offsetY": offset_y}

    tol = max(0.15, 0.01 * span)
    walls: list[dict[str, Any]] = []
    for idx, seg in enumerate(wall_segments):
        sx, sy = _to_canvas(seg.x1, seg.y1, layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        ex, ey = _to_canvas(seg.x2, seg.y2, layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        orient = _orientation(seg, bounds, tol)
        walls.append(
            {
                "id": f"wall-{idx+1}",
                "x1": sx,
                "y1": sy,
                "x2": ex,
                "y2": ey,
                "type": "exterior" if orient in ORIENTATION_HINTS else "interior",
                "orientation": orient if orient in ORIENTATION_HINTS else None,
                "thickness": 6 if orient in ORIENTATION_HINTS else 4,
            }
        )

    exterior = [w for w in walls if w["type"] == "exterior"]
    strict_window_segments = [
        s
        for s in segments
        if any(k in layer_lc(s) for k in ("window", "windows", "glass", "glazing", "win"))
        and not any(k in layer_lc(s) for k in EXCLUDED_LAYERS)
        and _segment_length(s) >= max(0.4, min_len * 0.55)
    ]
    dw_perimeter_windows = [
        s for s in segments if _is_perimeter_dw_window(s, bounds, span) and not any(k in layer_lc(s) for k in EXCLUDED_LAYERS)
    ]
    window_segments = [*strict_window_segments, *dw_perimeter_windows]
    windows: list[dict[str, Any]] = []
    for idx, seg in enumerate(window_segments):
        sx, sy = _to_canvas(seg.x1, seg.y1, layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        ex, ey = _to_canvas(seg.x2, seg.y2, layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
        horizontal = abs(seg.y2 - seg.y1) <= abs(seg.x2 - seg.x1)
        orient = _orientation(seg, bounds, 0.25) or "south"
        fallback_wall_id = exterior[0]["id"] if exterior else (walls[0]["id"] if walls else "wall-1")
        match = next((w for w in exterior if w.get("orientation") == orient), None)
        windows.append(
            {
                "id": f"win-{idx+1}",
                "wallId": (match or {"id": fallback_wall_id})["id"],
                "x": round((sx + ex) / 2),
                "y": round((sy + ey) / 2),
                "width": max(12, abs(ex - sx)) if horizontal else 10,
                "height": 10 if horizontal else max(12, abs(ey - sy)),
                "orientation": orient,
                "glazingType": "single",
            }
        )
    windows = _dedupe_windows(windows)

    mapped_seats: list[dict[str, Any]] = []
    rejected_seats = 0
    if seat_points_m:
        for sx_m, sy_m in seat_points_m:
            sx, sy = _to_canvas(sx_m, sy_m, layout["minX"], layout["maxY"], layout["scale"], layout["offsetX"], layout["offsetY"])
            if CANVAS_MARGIN <= sx <= CANVAS_WIDTH - CANVAS_MARGIN and CANVAS_MARGIN <= sy <= CANVAS_HEIGHT - CANVAS_MARGIN:
                sx, sy = _clamp_seat(sx, sy)
                mapped_seats.append({"id": f"seat-{len(mapped_seats)+1}", "userId": None, "x": sx, "y": sy, "label": f"Seat {len(mapped_seats)+1}"})
            else:
                rejected_seats += 1
    seats = mapped_seats if len(mapped_seats) >= 3 else _create_seat_grid(bounds, layout, 6)

    notes = list(extra_notes or [])
    if len(mapped_seats) < 3:
        notes.append("Seat extraction confidence was low, using guided fallback seat grid.")
    if len(dw_perimeter_windows) > 0:
        notes.append("DW layer was interpreted conservatively: only perimeter-aligned segments were treated as windows.")

    cad_geometry = _world_geometry_to_canvas(cad_world or {"lines": [], "polylines": [], "arcs": [], "circles": []}, layout)

    base_name = _normalize_name(file_name)
    return {
        "id": base_name or "dxf-import",
        "name": base_name or "Imported DXF",
        "width": CANVAS_WIDTH,
        "height": CANVAS_HEIGHT,
        "scale": scale,
        "city": "Riyadh",
        "buildingOrientation": 0,
        "walls": walls,
        "windows": windows,
        "seats": seats,
        "cadGeometry": cad_geometry,
        "importDiagnostics": {
            "wallCount": len(walls),
            "windowCount": len(windows),
            "seatCount": len(seats),
            "rejectedSeats": rejected_seats,
            "notes": notes,
        },
    }


def _read_doc_from_payload(payload: ConvertRequest) -> tuple[Any | None, str]:
    text: str | None = payload.dxfText
    if payload.dxfBase64:
        try:
            raw_bytes = base64.b64decode(payload.dxfBase64)
            tmp_path = ""
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
                    tmp.write(raw_bytes)
                    tmp_path = tmp.name
                try:
                    return ezdxf.readfile(tmp_path), ""
                except Exception:
                    try:
                        doc, _auditor = recover.readfile(tmp_path)
                        return doc, ""
                    except Exception:
                        pass
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)
            try:
                text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = raw_bytes.decode("latin-1", errors="ignore")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid base64 DXF payload: {exc}") from exc

    if not text:
        raise HTTPException(status_code=400, detail="No DXF content provided.")

    try:
        return ezdxf.read(io.StringIO(text)), text
    except Exception:
        try:
            doc, _auditor = recover.read(io.StringIO(text))
            return doc, text
        except Exception:
            return None, text


def _extract_segments_from_raw_text(text: str) -> list[Segment]:
    lines = text.replace("\r", "").split("\n")
    pairs: list[tuple[int, str]] = []
    for i in range(0, len(lines) - 1, 2):
        code_raw = lines[i].strip()
        value = lines[i + 1].strip()
        try:
            code = int(code_raw)
        except Exception:
            continue
        pairs.append((code, value))

    segments: list[Segment] = []
    i = 0
    while i < len(pairs):
        code, value = pairs[i]
        if code != 0:
            i += 1
            continue
        etype = value
        i += 1
        entity_pairs: list[tuple[int, str]] = []
        while i < len(pairs) and pairs[i][0] != 0:
            entity_pairs.append(pairs[i])
            i += 1

        layer = next((v for c, v in entity_pairs if c == 8), "0")
        if etype == "LINE":
            x1 = float(next((v for c, v in entity_pairs if c == 10), "0"))
            y1 = float(next((v for c, v in entity_pairs if c == 20), "0"))
            x2 = float(next((v for c, v in entity_pairs if c == 11), "0"))
            y2 = float(next((v for c, v in entity_pairs if c == 21), "0"))
            segments.append(Segment(x1, y1, x2, y2, layer))
        elif etype == "LWPOLYLINE":
            xs = [float(v) for c, v in entity_pairs if c == 10]
            ys = [float(v) for c, v in entity_pairs if c == 20]
            flags = int(float(next((v for c, v in entity_pairs if c == 70), "0")))
            count = min(len(xs), len(ys))
            pts = [(xs[j], ys[j]) for j in range(count)]
            for j in range(1, len(pts)):
                segments.append(Segment(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], layer))
            if (flags & 1) and len(pts) > 2:
                segments.append(Segment(pts[-1][0], pts[-1][1], pts[0][0], pts[0][1], layer))
    return segments


def _convert_doc_to_plan(doc: Any, file_name: str) -> dict[str, Any]:
    factor = _unit_factor(getattr(doc.header, "$INSUNITS", 0))
    extracted = _extract_geometry(doc, factor)
    segments = extracted["segments"]
    seat_points, seat_notes = _extract_seat_points_from_doc(doc, factor)
    return _segments_to_plan(
        segments=segments,
        file_name=file_name,
        seat_points_m=seat_points,
        cad_world=extracted["cad_world"],
        extra_notes=seat_notes,
    )


@app.post("/convert-dxf")
def convert_dxf(payload: ConvertRequest) -> dict[str, Any]:
    try:
        doc, text = _read_doc_from_payload(payload)
        if doc is not None:
            return _convert_doc_to_plan(doc, payload.fileName)
        raw_segments = _extract_segments_from_raw_text(text)
        if not raw_segments:
            raise HTTPException(status_code=400, detail="DXF parse failed in both ezdxf and raw fallback parser.")
        return _segments_to_plan(raw_segments, payload.fileName, None, None, ["Used raw DXF fallback parser."])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected conversion error: {exc}") from exc
