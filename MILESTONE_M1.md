# M1: SmartRoot Loads — PASSED ✓

**Date:** 2026-08-28  
**Status:** SmartRoot jar confirmed running under CheerpJ 4.2

## What Worked

- ✓ GitHub Pages serves Range requests (required for CheerpJ streaming)
- ✓ Prebuilt `ij.jar` from aicell-lab/imagej.js boots (~45 s cold start)
- ✓ SmartRoot jars staged in `lib/ImageJ/plugins/SmartRoot/`
- ✓ Plugin registration: SR_Explorer appears in Plugins menu
- ✓ Plugin execution: UI windows open, dialogs render
- ✓ Image I/O: 2414×2066 TIFF loads and displays in SmartRoot canvas
- ✓ Interactive components: tracing canvas and dialog controls respond

## Jars Staged

- `Smart_Root.jar` (316 KB, GPL-3.0)
- `jfreechart-1.0.13.jar` (1.4 MB, histogram charts)
- `jcommon-1.0.16.jar` (309 KB, JFreeChart dependency)
- `Image_Explorer.jar` (31 KB)
- `mysql-connector-java-5.1.7-bin.jar` (709 KB, stubbed — no TCP)

## Next Steps

**M2 — URL Handoff Shim**
- `bench.js`: parse `?open=<url>&scale=<px_per_mm>&unit=mm&preset=<name>&ref=<uuid>`
- `localFS.addFile()` for remote image fetch
- `Interpreter.runMacroSilent()` wrapper to prevent dialog freezes
- Preset launcher UI

**M3 — Six Presets**  
All six macros, starting with roots (SmartRoot semi-auto).

**M4 — FAIR Export**  
`.zip` bundle: measurements.csv, dataset.json (MIAPPE v1.2), provenance, RSML.

**M5 — AstroBotany Wiring**  
Register in `src/tools.ts`; forward `marker.pxPerMm` to `?scale=`.

## Known Limitations

- **No Java on dev machine:** Build of patched SmartRoot must happen in CI or cloud JDK.
- **~45 s cold boot:** Not ideal for demo, but acceptable for a research tool.
- **Single-threaded JVM:** Modal dialogs freeze the app; mitigation is silent-interpreter API.
- **SQL export disabled:** SmartRoot's MySQL export bypassed (no browser TCP); RSML is the export path.
