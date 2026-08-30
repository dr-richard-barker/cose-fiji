// CoSE FIJI Bench — rosettes preset
//
// Per-rosette morphometrics from an overhead image.
// Segmentation uses the a* channel of CIE L*a*b* ("Lab Stack" in this build).
// Green foliage sits at negative a*, which separates it from soil, perlite and
// most tray plastics far more reliably than a plain RGB threshold, and is stable
// under the colour casts that LED growth lighting introduces.
//
// One Results row per rosette.

setBatchMode(true);
setOption("BlackBackground", true);

getPixelSize(unit, pw, ph);
calibrated = (unit != "pixel" && unit != "pixels" && pw != 1);
orig = getTitle();

// --- 1. a* channel --------------------------------------------------------
run("Duplicate...", "title=__ros");
selectWindow("__ros");
if (bitDepth() != 24) run("RGB Color");
run("Lab Stack");            // 32-bit stack: 1=L*, 2=a*, 3=b*
setSlice(2);
run("Duplicate...", "title=__astar");
selectWindow("__astar");

// --- 2. threshold ---------------------------------------------------------
// Foliage = a* below the Otsu split (negative a* is green).
setAutoThreshold("Otsu");
run("Convert to Mask");
run("Despeckle");
run("Fill Holes");
run("Watershed");            // split rosettes that touch at the leaf margins

// --- 3. measure -----------------------------------------------------------
// minSize is in calibrated units when a scale is set, so gate in the same space.
if (calibrated) minSize = 20; else minSize = 2000;   // mm^2 vs px^2

run("Set Measurements...", "area perimeter shape feret's redirect=None decimal=3");
run("Analyze Particles...", "size=" + minSize + "-Infinity exclude clear");

n = nResults;

// Compactness = area / convex-ish area, approximated as area / (pi/4 * Feret^2).
// 1.0 = a tight disc, lower = a spread, deeply lobed rosette.
for (i = 0; i < n; i++) {
  a = getResult("Area", i);
  f = getResult("Feret", i);
  if (f > 0) c = a / (0.7853981634 * f * f); else c = 0;
  setResult("Compactness", i, c);
  setResult("Unit", i, unit);
}
updateResults();

close("__astar");
close("__ros");
selectWindow(orig);
setBatchMode(false);

print("[rosettes] n=" + n + "  unit=" + unit + "  calibrated=" + calibrated);
