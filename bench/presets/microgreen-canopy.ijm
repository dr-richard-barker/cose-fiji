// CoSE FIJI Bench — microgreen-canopy preset
//
// Whole-tray canopy metrics for stands too dense to segment into individuals.
// Vegetation is isolated on hue (HSB, "HSB Stack" in this build); uniformity is
// the coefficient of variation of brightness inside the canopy mask, which is
// what separates an even tray from a patchy one.

setBatchMode(true);
setOption("BlackBackground", true);

getPixelSize(unit, pw, ph);
calibrated = (unit != "pixel" && unit != "pixels" && pw != 1);
orig = getTitle();
getDimensions(W, H, nc, ns, nf);

// --- 1. HSB ---------------------------------------------------------------
run("Duplicate...", "title=__mg");
selectWindow("__mg");
if (bitDepth() != 24) run("RGB Color");
run("HSB Stack");            // 1=Hue, 2=Saturation, 3=Brightness

setSlice(1); run("Duplicate...", "title=__hue");
selectWindow("__mg"); setSlice(2); run("Duplicate...", "title=__sat");
selectWindow("__mg"); setSlice(3); run("Duplicate...", "title=__val");

// Keep a pristine copy of hue: thresholding below destroys __hue in place, and
// the greenness term in step 3 must read real hue values, not a 0/255 mask.
selectWindow("__hue"); run("Duplicate...", "title=__hue_raw");

// --- 2. canopy mask -------------------------------------------------------
// Green occupies roughly hue 50-110 on ImageJ's 0-255 hue scale (~70-155 deg).
// Require some saturation too, so grey/white tray edges are not counted.
selectWindow("__hue");
setThreshold(50, 110);
run("Convert to Mask");
selectWindow("__sat");
setThreshold(40, 255);
run("Convert to Mask");
imageCalculator("AND create", "__hue", "__sat");
rename("__canopy");
run("Despeckle");

getHistogram(hv, hc, 256);
vegPx = hc[255];
canopyCover = 100.0 * vegPx / (W * H);

// --- 3. greenness inside the canopy --------------------------------------
// Mean hue distance from pure green (hue 85 ~ 120 deg), normalised to 0..1
// where 1 is exactly green. Measured only where the canopy mask is set.
selectWindow("__canopy");
run("Create Selection");
haveSel = (selectionType() != -1);

if (haveSel) {
  selectWindow("__hue_raw");
  run("Restore Selection");
  getStatistics(selArea, meanHue);
  greenness = 1.0 - (abs(meanHue - 85) / 85.0);
  if (greenness < 0) greenness = 0;

} else {
  greenness = 0;
}

// --- 4. uniformity --------------------------------------------------------
// How evenly the canopy fills the tray, NOT how similar the green pixels are to
// each other. Coverage is measured per cell on an 8x6 grid and uniformity is
// 1 - CV of those cell coverages. A stand that is dense at one end and bare at
// the other scores low even though its total cover may look healthy; an evenly
// spread stand at the same total cover scores high.
selectWindow("__canopy");
run("Select None");
GX = 8; GY = 6;
cells = newArray(GX * GY);
cw = floor(W / GX); chh = floor(H / GY);
sum = 0;
for (gy = 0; gy < GY; gy++) {
  for (gx = 0; gx < GX; gx++) {
    makeRectangle(gx * cw, gy * chh, cw, chh);
    getStatistics(cArea, cMean);
    f = cMean / 255.0;                 // fraction of this cell covered
    cells[gy * GX + gx] = f;
    sum += f;
  }
}
run("Select None");
meanF = sum / (GX * GY);
if (meanF > 0) {
  ss = 0;
  for (i = 0; i < GX * GY; i++) ss += (cells[i] - meanF) * (cells[i] - meanF);
  sdF = sqrt(ss / (GX * GY));
  uniformity = 1.0 - (sdF / meanF);
  if (uniformity < 0) uniformity = 0;
} else {
  uniformity = 0;
}

// --- 5. readiness ---------------------------------------------------------
// Coverage is the dominant term; uniformity modulates it.
readiness = (canopyCover / 100.0) * uniformity;

close("__canopy"); close("__hue"); close("__hue_raw"); close("__sat"); close("__val"); close("__mg");
selectWindow(orig);
run("Select None");
setBatchMode(false);

run("Clear Results");
setResult("Label",           0, orig);
setResult("CanopyCover",     0, canopyCover);
setResult("GreennessIndex",  0, greenness);
setResult("Uniformity",      0, uniformity);
setResult("ReadinessScore",  0, readiness);
setResult("Unit",            0, unit);
setResult("Calibrated",      0, calibrated);
updateResults();

print("[microgreen] cover=" + d2s(canopyCover,2) + "%  green=" + d2s(greenness,3)
    + "  uniformity=" + d2s(uniformity,3) + "  readiness=" + d2s(readiness,3));
