# M2: URL Handoff + Image Pipeline — PASSED ✓

**Date:** 2026-08-28  
**Status:** Image fetch → localFS → IJ.open → scale → preset working

## What Works

- ✓ URL parameter parsing: `?open=<url>&scale=<px_per_mm>&unit=<mm|px>&preset=<name>&ref=<uuid>`
- ✓ Remote image fetch (CORS-enabled): 2414×2066 TIFF from SmartRoot repo
- ✓ Image loaded into localFS and opened in ImageJ
- ✓ Scale applied (`scale=0.0265` → Set Scale… macro runs silently)
- ✓ Preset loader: roots.json + roots.ijm both fetch and parse correctly
- ✓ Silent macro wrapper: prevents dialog freezes on macro execution

## Test Case

```
?open=https://raw.githubusercontent.com/SmartRoot/SmartRoot-Installation/…/quick_start_2.tif
&scale=0.0265&unit=mm&preset=roots
```

Result: Image opened in ImageJ with scale set, SmartRoot UI responsive.

## Limitations Found

1. **getTitle() returns null** in silent macro context — workaround: parse macro output or use window title from IJ.
2. **Preset loader expects `presets/` subdir** — must exist at same origin (not a limitation, just architecture note).
3. **UI placeholder methods** (showPresetUI, showError) not yet implemented — need HTML rendering for parameter controls.

## Next Steps

**M3 — Five More Presets**
- `rows`: plant row spacing + canopy cover
- `rosettes`: rosette area, circularity, compactness
- `petri-seedlings`: germination%, hypocotyl/root length
- `microgreen-canopy`: canopy cover%, greenness index
- `duckweed`: frond count, area, RGR

Each: `.ijm` macro + `.json` descriptor (method, outputs, ontology).

**M4 — FAIR Export**
- Measurements CSV (tidy, units in header)
- MIAPPE v1.2 metadata JSON (generated from checklist)
- RSML for roots (export from ImageJ)
- Provenance JSON (image URL, scale source, macro SHA-256, timestamp)
- RO-Crate wrapper

**M5 — AstroBotany Wiring**
- `src/tools.ts`: register as `launch: 'image'` tool
- `toolFrameSrc()`: forward `marker.pxPerMm` to `?scale=`
- `MarkerInspector.tsx`: "Analyse in FIJI" button on each entry

## Known Issues

- (None blocking M3. Placehold UI methods need implementation for UX, but analysis pipeline is solid.)
