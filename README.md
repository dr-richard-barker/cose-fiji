# CoSE FIJI Bench

ImageJ 1.54 in the browser, tuned for plant phenotyping, with calibrated
measurement and FAIR export. No installation.

**Live:** https://dr-richard-barker.github.io/cose-fiji/

> **This is ImageJ, not Fiji.** It runs ImageJ 1.54 plus a curated plugin set
> (SmartRoot, MorphoLibJ, Bio-Formats, ThunderSTORM, DeepImageJ). Fiji's full
> distribution depends on ImageJ2/SciJava, much of which does not run under
> CheerpJ. If a macro you have relies on a Fiji-only plugin, it will not work
> here — check Plugins ▸ for what is actually installed.

## What it does

Open an image, tell it the scale, pick an assay preset, get calibrated numbers
and a FAIR data bundle.

It is designed to be launched from the
[AstroBotany calibration image database](https://github.com/dr-richard-barker/AstroBotany_calibration_image_sharing_and_analysis),
which already recovers px/mm from the ArUco calibration marker in each photo and
hands that scale over, so measurements come out in millimetres rather than
pixels.

## URL parameters

```
?open=<image url>    CORS-readable image to analyse
&scale=<px per mm>   pixels per millimetre; omit and results stay in pixels
&unit=mm             unit label (default mm)
&preset=<name>       roots | rows | rosettes | petri-seedlings
                     | microgreen-canopy | duckweed
&ref=<id>            source record id, recorded in provenance
&embed=1             hide chrome when embedded in another site
```

Example:

```
https://dr-richard-barker.github.io/cose-fiji/?open=https://example.org/plate.tif&scale=37.8&preset=roots
```

## Presets

| Preset | Method | Reports |
|---|---|---|
| `roots` | rolling-ball flatten → Otsu → binary skeleton | total length, projected area, depth, spread, convex hull, length density |
| `rows` | ExG (2G−R−B) in 32-bit → Otsu → projection profile | canopy cover, row count, row spacing, plants/row |
| `rosettes` | CIE L\*a\*b\* a\* channel → Otsu → watershed | per-rosette area, perimeter, circularity, Feret, compactness |
| `petri-seedlings` | rolling-ball → Otsu → skeleton per seedling | seedling count, axis length, bounding height |
| `microgreen-canopy` | HSB hue+saturation mask, 8×6 grid evenness | cover, greenness, spatial evenness, readiness |
| `duckweed` | HSB mask → closing → watershed | frond count, total and mean frond area |

Each preset is a `.ijm` macro plus a `.json` descriptor in
[`bench/presets/`](bench/presets/) stating its method, its output columns with
units, and any ontology term. Descriptors are the source of truth for the
exported metadata.

### Validation

Presets were checked against synthetic images of known geometry:

| Preset | Expected | Measured |
|---|---|---|
| rosettes | discs ⌀10/14/8/12 mm → 78.54 / 153.94 / 50.27 / 113.10 mm² | 78.60 / 153.80 / 50.24 / 113.04 |
| rows | 4 rows @ 15.0 mm spacing | 4 rows, 15.0 mm |
| petri-seedlings | 6 axes @ 30.0 mm | 30.00 mm each |
| duckweed | 12 fronds, 7.07 mm² each | 12, 7.16 mm² |
| microgreen | 60.0% cover | 60.0% |

**Thresholds have not been tuned on real plant images.** The geometry is
correct; whether the segmentation finds *your* plants under *your* lighting and
substrate is a separate question. Expect to adjust threshold values per assay.

## FAIR export

Every analysis exports a `.zip`:

```
measurements.csv          tidy, units in the column headers
dataset.json              MIAPPE v1.2-aligned study and variable metadata
provenance.json           SHA-256 of image and macro, scale + its source
analysis.ijm              the exact macro that produced the numbers
roots.rsml                RSML root trace (roots preset)
ro-crate-metadata.json    RO-Crate 1.1 wrapper
README.md, LICENSE        method notes, CC-BY-4.0
```

`provenance.json` records `scaleSource`. If it reads `"none"`, every length in
the CSV is in **pixels** and must not be reported as a physical unit — the
bundle README says so too.

Ontology terms are only emitted where the term was resolved against
[EBI OLS](https://www.ebi.ac.uk/ols4); metrics without a clean match carry
`null` rather than a guess.

## Development

```bash
npm install
sh prepare.sh   # builds ij.jar from source; needs JDK 8 + Ant
npm run dev     # http-server on :8010 (Range support required by CheerpJ)
```

`prepare.sh` also downloads SmartRoot. Without a JDK you can mirror a prebuilt
`lib/ImageJ/` from any deployed instance instead.

### Notes for anyone extending this

- Enumerate the real command set with
  `await window.lib.ij.Menus.getCommands()` — do not assume a Fiji command exists.
- Run analysis macros with `IJ.runMacro`, **not**
  `Interpreter.runMacroSilent`. ImageJ passes command options through a
  thread-local; the silent interpreter runs on another thread, so dialog-driven
  commands (`Set Scale...`, `Subtract Background...`, `Analyze Particles...`)
  silently fall back to defaults and give wrong answers rather than erroring.
- Use `setVoxelSize()` rather than `run("Set Scale...")`. The latter does not
  override spatial calibration embedded in a TIFF.
- The JVM is single-threaded: a macro error opens a modal dialog and wedges it
  until dismissed.

## Credits and licensing

Built on **[ImageJ.JS](https://github.com/aicell-lab/imagej.js)** by the AICell
Lab (Wei Ouyang and contributors), which compiles ImageJ to WebAssembly with
CheerpJ. This repository is a fork with a plant-phenotyping preset layer, a
calibration handoff and a FAIR exporter added.

| Component | Licence |
|---|---|
| ImageJ (Wayne Rasband, NIH) | Public domain |
| [SmartRoot](https://github.com/SmartRoot/smartroot) (Lobet, Pagès, Draye) | GPL-3.0 |
| [MorphoLibJ](https://github.com/ijpb/MorphoLibJ) | LGPL |
| [Bio-Formats](https://www.openmicroscopy.org/bio-formats/) | GPL-2.0 |
| CheerpJ (Leaning Technologies) | Community Edition — free for non-commercial and open-source use only |
| This preset layer | MIT |
| Exported data bundles | CC-BY-4.0 |

**CheerpJ:** the Community Edition licence covers academic and open-source use.
Commercial deployment requires a licence from Leaning Technologies.

**SmartRoot is GPL-3.0.** It is redistributed here unmodified; source is at
<https://github.com/SmartRoot/smartroot>. Any modification made here must be
published under GPL-3.0.
