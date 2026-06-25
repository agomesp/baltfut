# ball-tracker (experiment)

Isolated spike for baltfut: detect the **match ball** in broadcast video and
project it onto a **2D pitch**, to eventually drive a live 2D-field view in the
app. Detection runs on the MacBook for dev (CPU/MPS) and on the RTX 3060 / Arch
box for live (CUDA).

## Isolation (intentional)

- Self-contained Python project: its **own venv + deps**, nothing shared with the
  Next.js / Deno toolchain. The app never imports this; this never imports the app.
- Heavy ML/CV deps (torch, ultralytics, opencv) stay out of the frontend bundle.
- The only future integration point is **publishing ball coordinates** through an
  injectable sink (stdout/file now -> a Supabase Realtime channel later, pointed at
  **local** Supabase, never prod).
- Its test gate is `pytest`, independent of the app's typecheck/lint/build gate.

## Layout

- `balltrack/pitch.py` — pitch geometry + image->pitch homography *(done, tested)*
- `balltrack/tracking.py` — Kalman ball smoothing + outlier gating *(done, tested)*
- `balltrack/detection.py` — Detector iface + `select_ball` + FakeDetector *(done; real YOLO adapter pending a model/clip)*
- `balltrack/sink.py` — injectable publisher: MemorySink + JsonlSink *(done, tested)*
- `balltrack/pipeline.py` — orchestrates detect -> select -> map -> smooth -> sink *(done, tested)*
- `balltrack/source.py` — frame source: video file (dev) / live stream (prod) *(later; pipeline takes any `(t, frame)` iterable for now)*

**Status:** the offline skeleton runs **end-to-end on a fake detector**, emitting a
pitch-coordinate timeline. Remaining real-world edges: a **YOLO adapter** and a
**VideoFileSource** (both need torch/ultralytics + a model + a sample clip).

## Setup & test (Mac dev)

```sh
cd experiments/ball-tracker
uv venv
uv pip install --python .venv/bin/python numpy opencv-python pytest
.venv/bin/python -m pytest
```
