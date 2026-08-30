// CoSE FIJI Bench — duckweed preset
//
// Frond counting and area for floating aquatic plants (Lemna, Landoltia, Wolffia).
// Fronds are isolated on hue against dark water, then split with a watershed so
// touching colonies still count as separate fronds.
//
// RGR is intentionally NOT computed here: it needs a second time point. bench.js
// supplies it when two analyses of the same ?ref= are compared, and the field is
// omitted rather than reported as 0 when only one image is available.

setBatchMode(true);
setOption("BlackBackground", true);

getPixelSize(unit, pw, ph);
calibrated = (unit != "pixel" && unit != "pixels" && pw != 1);
orig = getTitle();

// --- 1. hue mask ----------------------------------------------------------
run("Duplicate...", "title=__dw");
selectWindow("__dw");
if (bitDepth() != 24) run("RGB Color");
run("HSB Stack");
setSlice(1); run("Duplicate...", "title=__hue");
selectWindow("__dw"); setSlice(2); run("Duplicate...", "title=__sat");

selectWindow("__hue");
setThreshold(45, 115);          // green fronds
run("Convert to Mask");
selectWindow("__sat");
setThreshold(50, 255);          // reject grey reflections off the water surface
run("Convert to Mask");
imageCalculator("AND create", "__hue", "__sat");
rename("__fronds");

// --- 2. clean up + separate touching fronds ------------------------------
run("Despeckle");
run("Close-");                  // morphological closing (NOT the window "Close")
run("Fill Holes");
run("Watershed");

// --- 3. measure -----------------------------------------------------------
if (calibrated) minSize = 0.5; else minSize = 50;   // mm^2 vs px^2

run("Set Measurements...", "area shape redirect=None decimal=4");
run("Analyze Particles...", "size=" + minSize + "-Infinity clear");

nFronds = nResults;
totalArea = 0;
for (i = 0; i < nFronds; i++) totalArea += getResult("Area", i);
if (nFronds > 0) meanArea = totalArea / nFronds; else meanArea = 0;

close("__fronds"); close("__hue"); close("__sat"); close("__dw");
selectWindow(orig);
setBatchMode(false);

run("Clear Results");
setResult("Label",         0, orig);
setResult("FrondCount",    0, nFronds);
setResult("TotalArea",     0, totalArea);
setResult("MeanFrondArea", 0, meanArea);
setResult("Unit",          0, unit);
setResult("Calibrated",    0, calibrated);
updateResults();

print("[duckweed] fronds=" + nFronds + "  total=" + d2s(totalArea,3) + " " + unit + "^2"
    + "  mean=" + d2s(meanArea,4));
