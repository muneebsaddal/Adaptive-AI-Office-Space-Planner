# Adaptive Space Planner

Adaptive Space Planner is a workplace planning app for evaluating how an office layout supports employee comfort. It combines floor-plan geometry, seat assignments, employee preferences, city climate, time of day, and season to help teams compare design decisions before changing a space.

## What It Does

- Imports DXF floor plans with a Python conversion service and browser fallback.
- Provides an interactive plan editor for walls, windows, seats, pan, zoom, fit, and reset.
- Adds employee profiles with role, work style, health considerations, and environmental preferences.
- Assigns employees to seats and estimates each seat's temperature, light, noise, air quality, and humidity.
- Diagnoses comfort gaps for each employee and recommends spatial interventions.
- Generates design intervention cards for the current office scenario.
- Compares before-and-after scenarios to estimate the impact of glazing, ventilation, lighting, and acoustic changes.
- Supports a focused city selector with one representative city per climate case.

## Climate Cases

The app includes six city profiles selected to exercise different environmental conditions:

- `Riyadh` - hot dry
- `Singapore` - hot humid
- `Helsinki` - cold
- `Lisbon` - mild coastal
- `Abha` - high altitude
- `Delhi` - dense urban air

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Express production server bundle
- Python FastAPI DXF conversion service
- Vitest for focused logic tests

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run The App

```bash
npm run dev
```

Open `http://localhost:3000/`.

### 3. Optional DXF Service

For stronger DXF conversion support, run the Python service:

```bash
cd python
pip install -r requirements.txt
uvicorn dxf_service:app --host 127.0.0.1 --port 8765 --reload
```

If the Python service is unavailable, the app falls back to the in-browser DXF parser.

## Quality Checks

```bash
npm run check
npm run build
npx vitest run client/src/lib/floorPlanEngine.test.ts
```

## Project Structure

- `client/` - React frontend
- `server/` - Express production entry
- `python/` - DXF conversion service
- `shared/` - shared schema/utilities
- `REPORT.md` - detailed project report and use case case studies
