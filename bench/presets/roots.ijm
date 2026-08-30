// CoSE FIJI Bench — roots preset
//
// Automatic root-system metrics from a calibrated image.
//
// Command set note: this build is ImageJ 1.54 + MorphoLibJ + Bio-Formats. It does
// NOT ship Fiji's Ridge Detection or AnalyzeSkeleton, so illumination is flattened
// with a rolling-ball background subtraction and length is estimated from a
// core-ImageJ binary skeleton. Interactive topology (per-lateral tracing, RSML)
// comes from Plugins > SmartRoot > SR Explorer, not from this macro.
//
// Assumes: Set Scale has already been applied by bench.js (?scale=). If it has
// not, every length is reported in pixels and scale_source is "none".

setBatchMode(true);
setOption("BlackBackground", true);
run("Colors...", "foreground=white background=black selection=yellow");

// --- 0. calibration ------------------------------------------------------
getPixelSize(unit, pw, ph);
calibrated = (unit != "pixel" && unit != "pixels" && pw != 1);

// --- 1. normalise to 8-bit grayscale ------------------------------------
if (bitDepth() == 24) run("8-bit");
if (bitDepth() != 8) run("8-bit");

// Work on a duplicate so the user's original stays untouched on screen.
orig = getTitle();
run("Duplicate...", "title=__roots_work");
selectWindow("__roots_work");

// --- 2. flatten illumination --------------------------------------------
// Rolling-ball radius ~ 4x expected root width. 50 px is a reasonable default
// for scanned plates; exposed as ridgeRadius in roots.json.
run("Subtract Background...", "rolling=50 light");

// --- 3. threshold --------------------------------------------------------
// Roots are dark on a light plate, hence "Otsu" (not "Otsu dark").
setAutoThreshold("Otsu");
run("Convert to Mask");

// Remove speckle noise before skeletonising.
run("Despeckle");
run("Open");

// --- 4. root system area + bounding geometry ----------------------------
run("Create Selection");
if (selectionType() == -1) {
  // Nothing segmented — bail out with zeros rather than throwing.
  rootArea = 0; depth = 0; width = 0; hullArea = 0;
} else {
  getStatistics(rootArea);
  getSelectionBounds(bx, by, bw, bh);
  depth = bh * ph;
  width = bw * pw;

  // Convex hull area: hull of the whole root system.
  run("Convex Hull");
  getStatistics(hullArea);
  run("Select None");
}

// --- 5. skeleton length --------------------------------------------------
run("Select None");
run("Skeletonize");

// Total length is estimated as (skeleton pixel count x pixel width). This is the
// standard first-order estimate; it under-reads diagonal runs by up to ~8%, so it
// is reported as an approximation. SmartRoot tracing gives exact polyline lengths.
getHistogram(hvals, hcounts, 256);
skelPx = hcounts[255];
totalLength = skelPx * pw;

// --- 6. density ----------------------------------------------------------
if (hullArea > 0) density = totalLength / hullArea; else density = 0;

// --- 7. write results ----------------------------------------------------
close("__roots_work");
selectWindow(orig);
setBatchMode(false);

run("Clear Results");
setResult("Label",             0, orig);
setResult("TotalLength",       0, totalLength);
setResult("RootSystemArea",    0, rootArea);
setResult("MaxDepth",          0, depth);
setResult("LateralSpread",     0, width);
setResult("ConvexHullArea",    0, hullArea);
setResult("RootLengthDensity", 0, density);
setResult("Unit",              0, unit);
setResult("Calibrated",        0, calibrated);
updateResults();

print("[roots] length=" + d2s(totalLength, 2) + " " + unit
    + "  area=" + d2s(rootArea, 2) + " " + unit + "^2"
    + "  hull=" + d2s(hullArea, 2)
    + "  calibrated=" + calibrated);
