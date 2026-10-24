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

Presets were checked by hand against synthetic images of known geometry on
30 August 2026 (see [MILESTONE_STATUS.md](MILESTONE_STATUS.md)). **TODO:** the
test images, their generator and the run log were not committed, so these
figures cannot be reproduced from this repository yet. Commit them and re-run
before citing the numbers.

| Preset | Expected | Reported (30 Aug 2026, not reproducible yet) |
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
- Macros run on CheerpJ's main JVM. A macro error opens a modal dialog that
  blocks further macros until someone dismisses it (`bench.js` `macro()` has a
  watchdog that reports this). `index.html` also loads the upstream
  [threadhack runtime](threadhack/runtime/README.md), which by its README starts
  a pool of 2–10 Web Workers and sends rewritten thread work to them; the
  presets do not rely on it, and CoSE has not verified it.

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
| CheerpJ (Leaning Technologies) | [CheerpJ Community License](https://cheerpj.com/docs/licensing) — free for personal projects, FOSS projects and technical evaluations, with credit; business use needs a commercial licence |
| This fork's additions (preset layer, calibration handoff, FAIR exporter) | GPL-3.0 ([LICENSE](LICENSE)) |
| Exported data bundles | CC-BY-4.0 |

**CheerpJ:** the page loads CheerpJ 4.2 from Leaning Technologies' CDN
(`cjrtnc.leaningtech.com`). Their [licensing page](https://cheerpj.com/docs/licensing)
(accessed 24 Oct 2026) makes the Community License free for personal projects,
free and open-source projects and technical evaluations, with credit, and
requires a commercial licence for other business use. This fork is GPL-3.0, but
CoSE is a company. **TODO:** confirm with Leaning Technologies which licence
covers CoSE's deployment.

**SmartRoot is GPL-3.0.** `prepare.sh` downloads SmartRoot's released jars,
removes the bundled MySQL JDBC driver (it stalls start-up under CheerpJ; the
database export cannot work in a browser anyway) and adds a small entry point,
`SR_Trace_Current`, derived from SR_Explorer.java, whose GPL-3.0 source is in
[`smartroot-patch/`](smartroot-patch/). SmartRoot's own source is at
<https://github.com/SmartRoot/smartroot>.

## Upstream documentation

The other documents in this repository (`BUILD.md`, `CHANGES.md`, `preprint.md`,
`threadhack/`, `imagej-examples/`, `manuscript_html/` and the rest) were written
by the upstream ImageJ.JS authors. Each carries a banner: CoSE has not verified
their claims, numbers, citations or file references. They are kept as received,
except that the CellSAM reference in `preprint.md` and `manuscript_html/index.html`
was corrected to its published form (CrossRef, doi:10.1038/s41592-025-02879-w)
and an email address was removed from an agent log under `.svamp/`.
