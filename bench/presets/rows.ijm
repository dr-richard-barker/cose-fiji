// CoSE FIJI Bench — rows preset
//
// Canopy cover and row structure for plants grown in rows.
// Vegetation is separated with ExG = 2G - R - B (Woebbecke et al. 1995), computed
// in 32-bit so the subtraction is not clipped at 0, then Otsu-thresholded.
// Row centres are found from the horizontal projection profile of the mask.

setBatchMode(true);
setOption("BlackBackground", true);

getPixelSize(unit, pw, ph);
calibrated = (unit != "pixel" && unit != "pixels" && pw != 1);
orig = getTitle();
getDimensions(W, H, nc, ns, nf);

// --- 1. ExG ---------------------------------------------------------------
run("Duplicate...", "title=__rows_rgb");
selectWindow("__rows_rgb");
if (bitDepth() != 24) run("RGB Color");
run("Split Channels");
// Split Channels on an RGB image yields "<title> (red|green|blue)".
R = "__rows_rgb (red)";
G = "__rows_rgb (green)";
B = "__rows_rgb (blue)";

imageCalculator("Add create 32-bit", G, G);      // 2G
rename("__exg");
imageCalculator("Subtract 32-bit", "__exg", R);  // 2G - R
imageCalculator("Subtract 32-bit", "__exg", B);  // 2G - R - B
close(R); close(G); close(B);

// --- 2. vegetation mask ---------------------------------------------------
selectWindow("__exg");
setAutoThreshold("Otsu dark");
run("Convert to Mask");
run("Despeckle");

// --- 3. canopy cover ------------------------------------------------------
getHistogram(hv, hc, 256);
vegPx = hc[255];
canopyCover = 100.0 * vegPx / (W * H);

// --- 4. row detection from the horizontal projection profile --------------
// Count vegetation pixels per image row, then walk the profile and treat each
// contiguous run above 20% of the profile maximum as one crop row.
profile = newArray(H);
maxP = 0;
for (y = 0; y < H; y++) {
  n = 0;
  for (x = 0; x < W; x += 4) {           // stride 4 for speed; scales out below
    if (getPixel(x, y) > 128) n++;
  }
  profile[y] = n;
  if (n > maxP) maxP = n;
}

cut = maxP * 0.20;
rowCount = 0;
inRow = false;
rowStart = 0;
centres = newArray(H);
for (y = 0; y < H; y++) {
  if (profile[y] > cut && !inRow) { inRow = true; rowStart = y; }
  else if (profile[y] <= cut && inRow) {
    inRow = false;
    runLen = y - rowStart;
    if (runLen >= 8) {                    // ignore sub-8px noise bands
      centres[rowCount] = (rowStart + y) / 2.0;
      rowCount++;
    }
  }
}
if (inRow) { centres[rowCount] = (rowStart + H) / 2.0; rowCount++; }

// Mean spacing between adjacent row centres.
if (rowCount > 1) {
  tot = 0;
  for (i = 1; i < rowCount; i++) tot += (centres[i] - centres[i-1]);
  rowSpacing = (tot / (rowCount - 1)) * ph;
} else {
  rowSpacing = 0;
}

// --- 5. plant clusters ----------------------------------------------------
run("Select None");
run("Set Measurements...", "area bounding redirect=None decimal=3");
run("Analyze Particles...", "size=0-Infinity pixel clear");
clusters = nResults;
if (rowCount > 0) plantsPerRow = clusters / rowCount; else plantsPerRow = 0;

// --- 6. results -----------------------------------------------------------
close("__exg");
selectWindow(orig);
setBatchMode(false);

run("Clear Results");
setResult("Label",        0, orig);
setResult("CanopyCover",  0, canopyCover);
setResult("RowCount",     0, rowCount);
setResult("RowSpacing",   0, rowSpacing);
setResult("PlantsPerRow", 0, plantsPerRow);
setResult("ClusterCount", 0, clusters);
setResult("Unit",         0, unit);
setResult("Calibrated",   0, calibrated);
updateResults();

print("[rows] cover=" + d2s(canopyCover,2) + "%  rows=" + rowCount
    + "  spacing=" + d2s(rowSpacing,2) + " " + unit);
