import { useEffect, useRef, useState } from "react";
import { Download, Upload, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { FloorPlan, normalizeFloorPlanImport } from "@/lib/floorPlanEngine";
import { parseDxfFloorPlan } from "@/lib/dxfImport";

interface PlanImportPanelProps {
  plan: FloorPlan;
  onImportPlan: (plan: FloorPlan) => void;
  onResetPlan: () => void;
}

type Status =
  | { kind: "idle"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

async function convertDxfViaPythonService(text: string, fileName: string, dxfBase64?: string): Promise<FloorPlan> {
  const response = await fetch("http://127.0.0.1:8765/convert-dxf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dxfText: text, dxfBase64, fileName }),
  });

  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { detail?: string };
      detail = parsed.detail ?? raw;
    } catch {
      // Ignore JSON parse errors and keep raw text
    }
    throw new Error(detail || `DXF service failed with status ${response.status}`);
  }

  const payload = await response.json();
  return normalizeFloorPlanImport(payload);
}

export default function PlanImportPanel({
  plan,
  onImportPlan,
  onResetPlan,
}: PlanImportPanelProps) {
  const { isArabic } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({
    kind: "idle",
    message: isArabic
      ? "ارفع مخطط DXF لاستبدال المخطط التجريبي الحالي."
      : "Upload a DXF floor plan export to replace the current sample plan.",
  });

  useEffect(() => {
    setStatus(prev => {
      if (prev.kind !== "idle") return prev;
      return {
        kind: "idle",
        message: isArabic
          ? "ارفع مخطط DXF لاستبدال المخطط التجريبي الحالي."
          : "Upload a DXF floor plan export to replace the current sample plan.",
      };
    });
  }, [isArabic]);

  const importPlanFile = async (file: File) => {
    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".dwg")) {
        throw new Error(isArabic ? "ملف DWG غير مدعوم داخل المتصفح" : "DWG is not supported in-browser");
      }

      const isDxfByExt = lowerName.endsWith(".dxf");
      const text = await file.text();
      const isDxf = isDxfByExt || /(^|\n)0\r?\nSECTION\r?\n/i.test(text);
      let usedLocalFallback = false;
      let serviceError = "";
      const dxfBase64 = isDxf ? arrayBufferToBase64(await file.arrayBuffer()) : undefined;
      const nextPlan = isDxf
        ? await convertDxfViaPythonService(text, file.name, dxfBase64).catch((err: unknown) => {
            usedLocalFallback = true;
            serviceError = err instanceof Error ? err.message : "Unknown Python service error";
            return parseDxfFloorPlan(text, file.name);
          })
        : normalizeFloorPlanImport(JSON.parse(text));

      onImportPlan(nextPlan);
      const diagnostics = nextPlan.importDiagnostics;
      const diagnosticsSummary = diagnostics
        ? ` Walls: ${diagnostics.wallCount}, Windows: ${diagnostics.windowCount}, Seats: ${diagnostics.seatCount}, Rejected seats: ${diagnostics.rejectedSeats}.`
        : "";
      const notesSummary =
        diagnostics && diagnostics.notes.length > 0
          ? ` Notes: ${diagnostics.notes.join(" ")}`
          : "";
      setStatus({
        kind: "success",
        message: isDxf
          ? usedLocalFallback
            ? isArabic
              ? `تم تحميل ${nextPlan.name} باستخدام محلل المتصفح الاحتياطي.${diagnosticsSummary} خطأ خدمة بايثون: ${serviceError}${notesSummary}`
              : `Loaded ${nextPlan.name} using local fallback parser.${diagnosticsSummary} Python service error: ${serviceError}${notesSummary}`
            : isArabic
              ? `تم تحميل ${nextPlan.name} عبر خدمة DXF في بايثون.${diagnosticsSummary}${notesSummary}`
              : `Loaded ${nextPlan.name} via Python DXF service.${diagnosticsSummary}${notesSummary}`
          : isArabic
            ? `تم تحميل ${nextPlan.name}.${diagnosticsSummary}${notesSummary}`
            : `Loaded ${nextPlan.name}.${diagnosticsSummary}${notesSummary}`,
      });
    } catch {
      setStatus({
        kind: "error",
        message: isArabic
          ? "تعذر قراءة الملف. يرجى رفع ملف DXF صالح."
          : "Could not read that file. Upload a valid DXF floor plan export.",
      });
    }
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    void importPlanFile(file);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.name || "floor-plan"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`rounded-xl border p-4 bg-card transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-border"
      }`}
      onDragOver={e => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        handleFileChange(e.dataTransfer.files[0]);
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">DXF Upload</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {isArabic
              ? "ارفع ملف DXF للمخطط، أو استمر باستخدام المخطط التجريبي."
              : "Upload a DXF floor plan export, or keep the built-in sample layout."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            {isArabic ? "رفع DXF" : "Upload DXF"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleExport}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            {isArabic ? "تنزيل JSON" : "Download JSON"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onResetPlan}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            {isArabic ? "إعادة العينة" : "Reset Sample"}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".dxf,.dwg,.json,application/json"
        className="hidden"
        onChange={e => handleFileChange(e.target.files?.[0])}
      />

      <div
        className={`mt-3 rounded-lg border border-dashed px-3 py-2 text-xs ${
          status.kind === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : status.kind === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-border bg-muted/30 text-muted-foreground"
        }`}
      >
        {status.message}
      </div>
    </div>
  );
}
