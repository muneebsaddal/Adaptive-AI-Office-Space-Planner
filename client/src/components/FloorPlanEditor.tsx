/**
 * FloorPlanEditor — Interactive floor plan canvas
 * Design: Scandinavian Comfort Dashboard
 * Allows drawing walls, windows, placing seats, assigning employees
 */
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { FloorPlan, Wall, Window, Seat, Orientation, createDefaultFloorPlan, calculateSeatEnvironment, checkComfortCompliance } from '@/lib/floorPlanEngine';
import { UserProfile } from '@/lib/userProfileEngine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useArchitect } from '@/contexts/ArchitectContext';

type Tool = 'select' | 'wall' | 'window' | 'seat' | 'pan';

interface FloorPlanEditorProps {
  plan: FloorPlan;
  onPlanChange: (plan: FloorPlan) => void;
  profiles: UserProfile[];
  selectedSeatId: string | null;
  onSeatSelect: (seatId: string | null) => void;
}

const ORIENTATION_COLORS: Record<Orientation, string> = {
  north: '#3b82f6',
  south: '#ef4444',
  east: '#f59e0b',
  west: '#8b5cf6',
};

const ORIENTATION_LABELS: Record<Orientation, string> = {
  north: '', south: '', east: '.', west: '',
};

const comfort_SCORE_COLOR = (score: number) => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

export default function FloorPlanEditor({
  plan, onPlanChange, profiles, selectedSeatId, onSeatSelect
}: FloorPlanEditorProps) {
  const { city, simulationDate } = useArchitect();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [newWallOrientation, setNewWallOrientation] = useState<Orientation>('south');
  const [newWallType, setNewWallType] = useState<'exterior' | 'interior'>('exterior');
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; viewX: number; viewY: number; viewW: number; viewH: number } | null>(null);
  const [visibleLayers, setVisibleLayers] = useState({
    cad: true,
    walls: true,
    windows: true,
    seats: true,
  });
  const planRef = useRef(plan);
  planRef.current = plan;

  const getSVGPoint = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    // Use getBoundingClientRect + viewBox for accurate SVG coordinate mapping
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width;
    const scaleY = vb.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }, []);

  const snapToGrid = (v: number, grid = 25) => Math.round(v / grid) * grid;

  // Convert raw clientX/Y to SVG coords using the svgRef
  const clientToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width;
    const scaleY = vb.height / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    };
  }, []);

  const handleSeatMouseDown = useCallback((seatId: string, e: React.MouseEvent) => {
    if (activeTool !== 'select' || !visibleLayers.seats) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = clientToSVG(e.clientX, e.clientY);
    const seat = planRef.current.seats.find(s => s.id === seatId);
    if (!seat) return;
    setDraggingSeatId(seatId);
    setDragOffset({ dx: pt.x - seat.x, dy: pt.y - seat.y });
    onSeatSelect(seatId);
  }, [activeTool, clientToSVG, onSeatSelect]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'pan') {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      setIsPanning(true);
      setPanStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        viewX: vb.x,
        viewY: vb.y,
        viewW: vb.width,
        viewH: vb.height,
      });
      return;
    }
    if (activeTool === 'select') return;
    const pt = getSVGPoint(e);
    const snapped = { x: snapToGrid(pt.x), y: snapToGrid(pt.y) };

    if (activeTool === 'seat') {
      const newSeat: Seat = {
        id: `seat-${nanoid(10)}`,
        userId: null,
        x: snapped.x,
        y: snapped.y,
        label: `Seat ${plan.seats.length + 1}`,
      };
      onPlanChange({ ...plan, seats: [...plan.seats, newSeat] });
      return;
    }

    setDrawing(true);
    setDrawStart(snapped);
  }, [activeTool, getSVGPoint, onPlanChange, plan]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning && panStart) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = e.clientX - rect.left - panStart.x;
      const dy = e.clientY - rect.top - panStart.y;
      const scaleX = panStart.viewW / rect.width;
      const scaleY = panStart.viewH / rect.height;
      setViewport({
        x: panStart.viewX - dx * scaleX,
        y: panStart.viewY - dy * scaleY,
        w: panStart.viewW,
        h: panStart.viewH,
      });
      return;
    }
    const pt = getSVGPoint(e);
    setHoverPos({ x: snapToGrid(pt.x), y: snapToGrid(pt.y) });
  }, [getSVGPoint, isPanning, panStart]);

  // Global window mousemove/mouseup for seat dragging (works outside SVG bounds)
  useEffect(() => {
    if (!draggingSeatId) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      const pt = clientToSVG(e.clientX, e.clientY);
      const currentPlan = planRef.current;
      const snappedX = Math.max(20, Math.min(currentPlan.width - 20, snapToGrid(pt.x - dragOffset.dx)));
      const snappedY = Math.max(20, Math.min(currentPlan.height - 20, snapToGrid(pt.y - dragOffset.dy)));
      const updated = currentPlan.seats.map(s =>
        s.id === draggingSeatId ? { ...s, x: snappedX, y: snappedY } : s
      );
      onPlanChange({ ...currentPlan, seats: updated });
    };

    const onWindowMouseUp = () => {
      setDraggingSeatId(null);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [draggingSeatId, dragOffset, clientToSVG, onPlanChange]);

  const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }
    if (!drawing || !drawStart) return;
    const pt = getSVGPoint(e);
    const end = { x: snapToGrid(pt.x), y: snapToGrid(pt.y) };

    if (activeTool === 'wall') {
      const newWall: Wall = {
        id: `wall-${nanoid(10)}`,
        x1: drawStart.x, y1: drawStart.y,
        x2: end.x, y2: end.y,
        type: newWallType,
        orientation: newWallType === 'exterior' ? newWallOrientation : undefined,
        thickness: newWallType === 'exterior' ? 6 : 4,
      };
      onPlanChange({ ...plan, walls: [...plan.walls, newWall] });
    } else if (activeTool === 'window') {
      const newWindow: Window = {
        id: `win-${nanoid(10)}`,
        wallId: '',
        x: drawStart.x, y: drawStart.y,
        width: Math.abs(end.x - drawStart.x) || 60,
        height: Math.abs(end.y - drawStart.y) || 10,
        orientation: newWallOrientation,
        glazingType: 'single',
      };
      onPlanChange({ ...plan, windows: [...plan.windows, newWindow] });
    }

    setDrawing(false);
    setDrawStart(null);
  }, [drawing, drawStart, activeTool, getSVGPoint, isPanning, plan, onPlanChange, newWallOrientation, newWallType]);

  const handleSeatClick = (seatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Only toggle selection on click (not after drag)
    if (activeTool === 'select' && !draggingSeatId) {
      onSeatSelect(seatId === selectedSeatId ? null : seatId);
    }
  };

  const assignUserToSeat = (seatId: string, userId: string) => {
    const updated = plan.seats.map(s =>
      s.id === seatId ? { ...s, userId: userId || null } : s
    );
    onPlanChange({ ...plan, seats: updated });
  };

  const deleteSeat = (seatId: string) => {
    onPlanChange({ ...plan, seats: plan.seats.filter(s => s.id !== seatId) });
    if (selectedSeatId === seatId) onSeatSelect(null);
  };

  const deleteWall = (wallId: string) => {
    onPlanChange({ ...plan, walls: plan.walls.filter(w => w.id !== wallId) });
  };

  const resetToDefault = () => {
    onPlanChange(createDefaultFloorPlan());
    onSeatSelect(null);
  };

  // Compute comfort scores for seats
  const seatScores: Record<string, number> = {};
  plan.seats.forEach(seat => {
    const profile = profiles.find(p => p.id === seat.userId);
    if (profile) {
      const env = calculateSeatEnvironment(seat, plan, city, simulationDate);
      const compliance = checkComfortCompliance(env);
      seatScores[seat.id] = compliance.score;
    }
  });

  const fittedViewBox = useMemo(() => {
    const points: Array<{ x: number; y: number }> = [];

    plan.cadGeometry?.lines.forEach((line) => {
      points.push({ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 });
    });
    plan.cadGeometry?.polylines.forEach((polyline) => {
      polyline.points.forEach((point) => points.push({ x: point.x, y: point.y }));
    });
    plan.cadGeometry?.arcs.forEach((arc) => {
      points.push(
        { x: arc.cx - arc.r, y: arc.cy - arc.r },
        { x: arc.cx + arc.r, y: arc.cy + arc.r },
      );
    });
    plan.cadGeometry?.circles.forEach((circle) => {
      points.push(
        { x: circle.cx - circle.r, y: circle.cy - circle.r },
        { x: circle.cx + circle.r, y: circle.cy + circle.r },
      );
    });

    plan.walls.forEach(wall => {
      points.push({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
    });

    plan.windows.forEach(win => {
      const halfW = win.width / 2;
      const halfH = Math.max(win.height, 10) / 2;
      points.push(
        { x: win.x - halfW, y: win.y - halfH },
        { x: win.x + halfW, y: win.y + halfH }
      );
    });

    plan.seats.forEach(seat => {
      points.push({ x: seat.x - 24, y: seat.y - 24 }, { x: seat.x + 24, y: seat.y + 24 });
    });

    if (points.length === 0) {
      return { x: 0, y: 0, w: plan.width, h: plan.height };
    }

    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    // Adaptive padding keeps drawing comfortably framed at different sizes.
    const padding = Math.max(24, Math.round(Math.max(contentWidth, contentHeight) * 0.12));

    const vbX = minX - padding;
    const vbY = minY - padding;
    const vbW = contentWidth + padding * 2;
    const vbH = contentHeight + padding * 2;

    return { x: vbX, y: vbY, w: vbW, h: vbH };
  }, [plan.walls, plan.windows, plan.seats, plan.width, plan.height]);

  const [viewport, setViewport] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    setViewport(fittedViewBox);
  }, [plan.id, plan.width, plan.height]);

  const effectiveView = viewport ?? fittedViewBox;
  const viewBox = `${effectiveView.x} ${effectiveView.y} ${effectiveView.w} ${effectiveView.h}`;

  const zoomBy = useCallback((factor: number) => {
    setViewport((prev) => {
      const source = prev ?? fittedViewBox;
      const centerX = source.x + source.w / 2;
      const centerY = source.y + source.h / 2;
      const nextW = Math.max(120, source.w / factor);
      const nextH = Math.max(80, source.h / factor);
      return {
        x: centerX - nextW / 2,
        y: centerY - nextH / 2,
        w: nextW,
        h: nextH,
      };
    });
  }, [fittedViewBox]);

  const fitToContent = useCallback(() => {
    setViewport(fittedViewBox);
  }, [fittedViewBox]);

  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, w: plan.width, h: plan.height });
  }, [plan.height, plan.width]);

  const arcPathD = useCallback((cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    let start = startAngle;
    let end = endAngle;
    while (end < start) end += 360;
    const delta = end - start;
    const largeArcFlag = delta > 180 ? 1 : 0;
    const startRad = (Math.PI / 180) * start;
    const endRad = (Math.PI / 180) * end;
    const sx = cx + r * Math.cos(startRad);
    const sy = cy - r * Math.sin(startRad);
    const ex = cx + r * Math.cos(endRad);
    const ey = cy - r * Math.sin(endRad);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArcFlag} 0 ${ex} ${ey}`;
  }, []);

  const toggleLayer = (key: keyof typeof visibleLayers) => {
    setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-lg">
        <span className="text-xs font-medium text-muted-foreground ml-1">Tool:</span>
        {(['select', 'pan', 'wall', 'window', 'seat'] as Tool[]).map(tool => (
          <Button
            key={tool}
            size="sm"
            variant={activeTool === tool ? 'default' : 'outline'}
            onClick={() => setActiveTool(tool)}
            className="text-xs h-7"
          >
            {tool === 'select' && '↖ Select'}
            {tool === 'pan' && '✋ Pan'}
            {tool === 'wall' && '▬ Wall'}
            {tool === 'window' && '⬜ Window'}
            {tool === 'seat' && '🪑 Seat'}
          </Button>
        ))}

        {(activeTool === 'wall' || activeTool === 'window') && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <Select value={newWallOrientation} onValueChange={v => setNewWallOrientation(v as Orientation)}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="Orientation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="north">North</SelectItem>
                <SelectItem value="south">South</SelectItem>
                <SelectItem value="east">East</SelectItem>
                <SelectItem value="west">West</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {activeTool === 'wall' && (
          <Select value={newWallType} onValueChange={v => setNewWallType(v as 'exterior' | 'interior')}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exterior">Exterior</SelectItem>
              <SelectItem value="interior">Interior</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => zoomBy(1.25)}>
          ＋ Zoom In
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => zoomBy(0.8)}>
          － Zoom Out
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={fitToContent}>
          Fit
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={resetView}>
          Reset View
        </Button>
        <Button size="sm" variant="outline" onClick={resetToDefault} className="text-xs h-7">
          ↺ Sample Plan
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 px-1">
        {([
          ['cad', 'CAD'],
          ['walls', 'Walls'],
          ['windows', 'Windows'],
          ['seats', 'Seats'],
        ] as const).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={visibleLayers[key] ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => toggleLayer(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground px-1">
        {(['north', 'south', 'east', 'west'] as Orientation[]).map(o => (
          <span key={o} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ORIENTATION_COLORS[o] }} />
            {o === 'north' ? 'North' : o === 'south' ? 'South' : o === 'east' ? 'East' : 'West'}
          </span>
        ))}
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-green-500" /> High comfort</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-yellow-500" /> Medium</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Low</span>
      </div>

      {/* Canvas */}
      <div className="relative border border-border rounded-xl overflow-hidden bg-[#f8f9fa] dark:bg-[#1a1f2e]" style={{ aspectRatio: `${plan.width}/${plan.height}` }}>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className={`w-full h-full ${activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isPanning) {
              setIsPanning(false);
              setPanStart(null);
            }
          }}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-border" opacity="0.4" />
            </pattern>
          </defs>
          <rect width={plan.width} height={plan.height} fill="url(#grid)" />

          {/* Scale indicator */}
          <g transform={`translate(${plan.width - 120}, ${plan.height - 30})`}>
            <line x1="0" y1="0" x2={plan.scale} y2="0" stroke="#666" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#666" strokeWidth="2" />
            <line x1={plan.scale} y1="-4" x2={plan.scale} y2="4" stroke="#666" strokeWidth="2" />
            <text x={plan.scale / 2} y="-6" textAnchor="middle" fontSize="10" fill="#666">1m</text>
          </g>

          {/* Compass */}
          <g transform="translate(30, 30)">
            <circle r="18" fill="white" fillOpacity="0.9" stroke="#ddd" strokeWidth="1" />
            <text x="0" y="-6" textAnchor="middle" fontSize="9" fill={ORIENTATION_COLORS.north} fontWeight="bold"></text>
            <text x="0" y="14" textAnchor="middle" fontSize="9" fill={ORIENTATION_COLORS.south}></text>
            <text x="12" y="4" textAnchor="middle" fontSize="9" fill={ORIENTATION_COLORS.east}></text>
            <text x="-12" y="4" textAnchor="middle" fontSize="9" fill={ORIENTATION_COLORS.west}></text>
            <polygon points="0,-12 -4,0 0,-4 4,0" fill={ORIENTATION_COLORS.north} />
          </g>

          {/* CAD Geometry */}
          {visibleLayers.cad && plan.cadGeometry && (
            <g opacity="0.9">
              {plan.cadGeometry.lines.map((line, idx) => (
                <line
                  key={`cad-line-${idx}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#111827"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
              ))}
              {plan.cadGeometry.polylines.map((polyline, idx) => (
                <polyline
                  key={`cad-poly-${idx}`}
                  points={polyline.points.map(point => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke="#111827"
                  strokeOpacity="0.4"
                  strokeWidth="1.4"
                />
              ))}
              {plan.cadGeometry.polylines
                .filter(polyline => polyline.closed && polyline.points.length > 2)
                .map((polyline, idx) => (
                  <line
                    key={`cad-poly-close-${idx}`}
                    x1={polyline.points[polyline.points.length - 1].x}
                    y1={polyline.points[polyline.points.length - 1].y}
                    x2={polyline.points[0].x}
                    y2={polyline.points[0].y}
                    stroke="#111827"
                    strokeOpacity="0.4"
                    strokeWidth="1.4"
                  />
                ))}
              {plan.cadGeometry.arcs.map((arc, idx) => (
                <path
                  key={`cad-arc-${idx}`}
                  d={arcPathD(arc.cx, arc.cy, arc.r, arc.startAngle, arc.endAngle)}
                  fill="none"
                  stroke="#111827"
                  strokeOpacity="0.42"
                  strokeWidth="1.4"
                />
              ))}
              {plan.cadGeometry.circles.map((circle, idx) => (
                <circle
                  key={`cad-circle-${idx}`}
                  cx={circle.cx}
                  cy={circle.cy}
                  r={circle.r}
                  fill="none"
                  stroke="#111827"
                  strokeOpacity="0.4"
                  strokeWidth="1.3"
                />
              ))}
            </g>
          )}

          {/* Walls */}
          {visibleLayers.walls && plan.walls.map(wall => (
            <g key={wall.id}>
              <line
                x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
                stroke={wall.type === 'exterior'
                  ? (wall.orientation ? ORIENTATION_COLORS[wall.orientation] : '#374151')
                  : '#9ca3af'}
                strokeWidth={wall.thickness}
                strokeLinecap="round"
                className="cursor-pointer"
                onClick={e => { e.stopPropagation(); if (activeTool === 'select') deleteWall(wall.id); }}
              />
              {wall.type === 'exterior' && wall.orientation && (
                <text
                  x={(wall.x1 + wall.x2) / 2}
                  y={(wall.y1 + wall.y2) / 2 - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={ORIENTATION_COLORS[wall.orientation]}
                  fontWeight="bold"
                >
                  {ORIENTATION_LABELS[wall.orientation]}
                </text>
              )}
            </g>
          ))}

          {/* Windows */}
          {visibleLayers.windows && plan.windows.map(win => (
            <g key={win.id}>
              <rect
                x={win.x - win.width / 2}
                y={win.y - (win.height || 10) / 2}
                width={win.width}
                height={Math.max(win.height, 10)}
                fill={ORIENTATION_COLORS[win.orientation]}
                fillOpacity="0.6"
                stroke={ORIENTATION_COLORS[win.orientation]}
                strokeWidth="2"
                rx="2"
              />
              <text x={win.x} y={win.y + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">
                Window
              </text>
            </g>
          ))}

          {/* Drawing preview */}
          {drawing && drawStart && hoverPos && (
            <line
              x1={drawStart.x} y1={drawStart.y}
              x2={hoverPos.x} y2={hoverPos.y}
              stroke={activeTool === 'window' ? ORIENTATION_COLORS[newWallOrientation] : '#374151'}
              strokeWidth={activeTool === 'wall' ? 4 : 8}
              strokeDasharray="6,4"
              opacity="0.7"
            />
          )}

          {/* Seats */}
          {visibleLayers.seats && plan.seats.map(seat => {
            const profile = profiles.find(p => p.id === seat.userId);
            const score = seatScores[seat.id];
            const isSelected = selectedSeatId === seat.id;

            return (
              <g
                key={seat.id}
                transform={`translate(${seat.x}, ${seat.y})`}
                className={activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                onClick={e => handleSeatClick(seat.id, e)}
                onMouseDown={e => handleSeatMouseDown(seat.id, e)}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle r="22" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4,2" />
                )}

                {/* Seat circle */}
                <circle
                  r="16"
                  fill={profile ? comfort_SCORE_COLOR(score ?? 50) : '#e5e7eb'}
                  fillOpacity={profile ? 0.9 : 0.5}
                  stroke={isSelected ? '#6366f1' : '#fff'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />

                {/* Avatar or empty icon */}
                <text textAnchor="middle" dominantBaseline="central" fontSize="14">
                  {profile ? profile.avatar : '🪑'}
                </text>

                {/* Score badge */}
                {profile && score !== undefined && (
                  <g transform="translate(10, -10)">
                    <circle r="8" fill={comfort_SCORE_COLOR(score)} stroke="white" strokeWidth="1.5" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="7" fill="white" fontWeight="bold">
                      {score}
                    </text>
                  </g>
                )}

                {/* Label */}
                <text
                  y="26"
                  textAnchor="middle"
                  fontSize="9"
                  fill="#374151"
                  className="dark:fill-gray-300"
                >
                  {profile ? profile.name : seat.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected seat panel */}
      {selectedSeatId && (() => {
        const seat = plan.seats.find(s => s.id === selectedSeatId);
        if (!seat) return null;
        const profile = profiles.find(p => p.id === seat.userId);
        const selectedUserValue = seat.userId && profiles.some(p => p.id === seat.userId)
          ? seat.userId
          : '__none__';
        const env = calculateSeatEnvironment(seat, plan, city, simulationDate);

        return (
          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{seat.label}</h3>
              <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => deleteSeat(seat.id)}>
                Delete Seat
              </Button>
            </div>

            {/* Assign employee */}
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">Assign Employee:</label>
              <Select
                value={selectedUserValue}
                onValueChange={v => assignUserToSeat(seat.id, v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.avatar} {p.name} — {p.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Environment quick stats */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-bold text-base">{env.estimatedTemperature}°C</div>
                <div className="text-muted-foreground">Temp</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-bold text-base">{env.estimatedIlluminance}</div>
                <div className="text-muted-foreground">lux</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-bold text-base">{env.estimatedNoise}</div>
                <div className="text-muted-foreground">dB</div>
              </div>
            </div>

            {env.nearestWindowOrientation && (
              <p className="text-xs text-muted-foreground mt-2">
                <>
                      Nearest window: {env.distanceToNearestWindow}m —
                      {env.nearestWindowOrientation === 'south' ? ' South' :
                        env.nearestWindowOrientation === 'north' ? ' North' :
                        env.nearestWindowOrientation === 'east' ? ' East' : ' West'} facade
                    </>
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
