# WELL Adaptive Space Planner

An adaptive office planning app for evaluating employee comfort against WELL v2-inspired criteria using floor-plan geometry, seat assignment, and environmental simulation logic.

## Features

- DXF floor plan import (with Python service + browser fallback)
- Interactive plan editor (walls, windows, seats, pan/zoom/fit/reset)
- Employee profile creation and seat assignment
- Comfort diagnosis, intervention generation, and before/after comparison
- Dark mode toggle
- Arabic/English language toggle

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Express (bundled server entry)
- Python FastAPI DXF conversion service (`python/dxf_service.py`)

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) (Optional, recommended) Run DXF Python service

```bash
cd python
pip install -r requirements.txt
uvicorn dxf_service:app --host 127.0.0.1 --port 8765 --reload
```

### 3) Run the app

```bash
npm run dev
```

Open:

- `http://localhost:3000/`

## Build and Type Check

```bash
npm run check
npm run build
```

## Project Structure

- `client/` — frontend app
- `server/` — server entry for production bundle
- `python/` — DXF conversion service
- `shared/` — shared code/utilities

## Notes

- If the Python DXF service is not running, the app falls back to in-browser DXF parsing.
- The app supports `.dxf` import directly; `.dwg` is not parsed in-browser.
