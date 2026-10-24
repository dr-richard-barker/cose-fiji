# CoSE FIJI Bench — verified status

Recorded by hand on 2026-08-30; amended 2026-10-24. The logs, test images and
outputs behind these lines were not committed, so most of them cannot be
re-checked from this repository. Rows marked **TODO** need re-running with their
evidence committed; rows dated 24 Oct 2026 were re-checked that day.

## Verified working

| Area | Evidence |
|---|---|
| Static hosting | GitHub Pages serves HTTP Range (`206`, `accept-ranges: bytes`) — CheerpJ 4.2 requires it. Re-checked 24 Oct 2026 with `curl -r 0-9` on `lib/ImageJ/ij.jar` |
| ImageJ boot | ImageJ 1.54s6 starts and opens an image (local build, 24 Oct 2026). Java version, command count and cold boot time: **TODO**, not logged |
| SmartRoot | **Not verified.** SR_Explorer's constructor throws under CheerpJ (commit f09a11c); dropping the MySQL driver stopped the start-up hang. The replacement entry point, Plugins ▸ SmartRoot ▸ Trace current image (`SR_Trace_Current`), is compiled in CI but has not been tested. **TODO** |
| Image handoff | `?open=` → fetch → `localFS` → `IJ.open`. Re-checked 24 Oct 2026 on a local build (the ABCD v2 card opened) |
| Calibration | `?scale=37.8` → `setVoxelSize` → title bar reads 63.86 × 54.66 mm. **TODO:** not logged |
| FAIR bundle | 9-file `.zip` (`fair.js` `build()`); system `unzip` check (CRC32, nested paths, empty + 200 KB entries, UTF-8) **TODO:** not logged |
| AstroBotany wiring | `tsc --noEmit` clean; marker `pxPerMm` reaches `?scale=`. **TODO:** checked in the AstroBotany repo, not logged here |

## Preset validation

Synthetic images of known geometry, plus one real root TIFF. **TODO:** the
images, their generator, the root TIFF and the run log were not committed, so
none of these figures can be reproduced from this repository yet.

| Preset | Test | Expected | Measured |
|---|---|---|---|
| rosettes | discs ⌀10/14/8/12 mm | 78.54 / 153.94 / 50.27 / 113.10 mm² | 78.60 / 153.80 / 50.24 / 113.04 (<0.1%) |
| rows | 4 rows, 150 px @ 10 px/mm | 4 rows, 15.0 mm | 4 rows, 15.0 mm (exact) |
| petri-seedlings | 6 axes, 300 px | 30.0 mm each | 30.00 mm each (exact) |
| duckweed | 12 fronds ⌀3 mm | 12, 7.07 mm² | 12, 7.16 mm² |
| microgreen | 60% cover | 60.0% | 60.0% (exact) |
| roots | real root TIFF @ 37.8 px/mm | — | 743.94 mm length, 89.51 mm² area |

The roots figure has no ground truth, so the cross-check is physical: area ÷
length = **0.12 mm mean root diameter**, and depth (49.6 mm) and spread (62.5 mm)
both fit inside the 63.9 × 54.7 mm frame.

microgreen `Uniformity` was separately checked to discriminate stands at
*identical* 60% cover: dense-one-end 0.221, solid block 0.262, stripes 0.942,
even speckle 0.974.

## Constraints discovered (these shape the code)

**`Interpreter.runMacroSilent` is unusable for analysis.** It returns
`[status, value]`, and because ImageJ passes command options through a
thread-local, every dialog-driven command silently falls back to defaults:

| command | `IJ.runMacro` | `runMacroSilent` |
|---|---|---|
| `Set Scale...` | applies | ignored |
| `Subtract Background...` | applies | no-op |
| `Analyze Particles...` | 2 of 2 | 1 of 2 |

Presets therefore run through `IJ.runMacro`. The cost is that a macro *error*
opens a modal dialog that blocks CheerpJ's main JVM until dismissed, so
`macro()` carries a watchdog that reports this instead of hanging. (The
upstream threadhack runtime adds worker JVMs for rewritten thread work; the
presets do not use it.)

**Embedded TIFF resolution beats `run("Set Scale...")`.** The quick-start images
declare an inch resolution; lengths came out in inches while labelled mm. Fixed
with `setVoxelSize()`, which has no dialog and overrides file calibration.

**This build is not Fiji.** No Ridge Detection, no AnalyzeSkeleton, no
`CIELAB Stack`. It has ImageJ 1.54 core + MorphoLibJ + Bio-Formats + ThunderSTORM
+ DeepImageJ. Macros are written against that set.

## Not done

- **Per-lateral root topology.** Needs AnalyzeSkeleton or SmartRoot tracing.
  `roots.rsml` carries measured properties and deliberately omits `<geometry>`
  rather than fabricating polylines.
- **Hypocotyl/root split** in petri-seedlings — needs the collet position.
- **Duckweed RGR** — needs two time points.
- **Preset validation on real plant images.** Geometry is proven; thresholds are
  not yet tuned to real cultivars, lighting or substrate.
- **Deployment.** `prepare.sh` needs JDK 8 + Ant; the existing CI workflow does
  this. Local dev uses the prebuilt `ij.jar` mirrored from the upstream site.
