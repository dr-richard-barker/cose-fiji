// CoSE FIJI Bench — petri-seedlings preset
//
// Seedling counting and axis length on agar plates, imaged vertically so roots
// grow down the plate.
//
// Per seedling this reports the skeleton axis length and the bounding-box height.
// It does NOT split hypocotyl from root: that needs the seed/collet position,
// which is a topology question this build has no AnalyzeSkeleton for. Use
// SmartRoot tracing when the split matters, rather than a fixed-fraction guess.
//
// Length is derived from the skeleton's calibrated Area rather than a per-ROI
// pixel count: a skeleton is one pixel wide, so Area = n*pw*ph and the axis
// length is Area/ph. This avoids a ROI-manager round-trip that is unreliable
// under setBatchMode in this CheerpJ build.

setBatchMode(true);
setOption("BlackBackground", true);

getPixelSize(unit, pw, ph);
calibrated = (unit != "pixel" && unit != "pixels" && pw != 1);
orig = getTitle();

run("Duplicate...", "title=__seed");
selectWindow("__seed");
if (bitDepth() == 24) run("8-bit");
if (bitDepth() != 8) run("8-bit");

// --- 1. segment -----------------------------------------------------------
// Seedlings are dark on a pale agar plate.
run("Subtract Background...", "rolling=100 light");
setAutoThreshold("Otsu");
run("Convert to Mask");
run("Despeckle");

// --- 2. skeletonise the whole plate at once ------------------------------
run("Select None");
run("Skeletonize");

// --- 3. one particle per seedling ----------------------------------------
// Gate on skeleton area. A 20 mm axis at 0.1 mm/px is ~200 px => 2 mm^2 of
// skeleton, so 0.3 mm^2 keeps real seedlings and drops speckle.
if (calibrated) minSize = 0.3; else minSize = 40;   // mm^2 vs px^2

run("Set Measurements...", "area bounding redirect=None decimal=4");
run("Analyze Particles...", "size=" + minSize + "-Infinity exclude clear");

nSeedlings = nResults;
totalAxis = 0;
for (i = 0; i < nSeedlings; i++) {
  a = getResult("Area", i);
  if (ph > 0) axisLen = a / ph; else axisLen = 0;
  setResult("AxisLength", i, axisLen);
  setResult("Unit", i, unit);
  totalAxis += axisLen;
}
updateResults();

if (nSeedlings > 0) meanAxis = totalAxis / nSeedlings; else meanAxis = 0;

close("__seed");
selectWindow(orig);
run("Select None");
setBatchMode(false);

print("[petri-seedlings] n=" + nSeedlings + "  mean axis=" + d2s(meanAxis,2) + " " + unit
    + "  calibrated=" + calibrated);
