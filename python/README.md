# DXF Conversion Service (Option B)

This project now supports a Python DXF conversion service using `ezdxf`.

## 1) Install dependencies

```bash
cd python
pip install -r requirements.txt
```

## 2) Run the service

```bash
cd python
uvicorn dxf_service:app --host 127.0.0.1 --port 8765 --reload
```

## 3) Use in the app

- Start this service before importing DXF files in the UI.
- Frontend will call `http://127.0.0.1:8765/convert-dxf`.
- If service is unavailable, UI falls back to the in-browser parser.

## Health check

`GET http://127.0.0.1:8765/health`

