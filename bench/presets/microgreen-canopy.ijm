// CoSE FIJI Bench: Microgreen Canopy Preset
// Canopy coverage, greenness, texture uniformity

getDimensions(w, h, channels, slices, frames);
if (channels != 3) { run("Stack to RGB"); run("RGB Stack"); }
if (bitDepth() != 8) { run("8-bit"); }

// HSV conversion for robust green detection
print("Converting to HSV...");
run("HSV Stack");
selectWindow("H");
hStack = getImageID();
selectWindow("S");
sStack = getImageID();
selectWindow("V");
vStack = getImageID();

// Threshold: green is H=120±30 (hue range 90–150 in 0–255 scale)
// Use hue to isolate green
selectImage(hStack);
setThreshold(90, 150);
run("Convert to Mask");
run("Dilate");
run("Erode");
rename("GreenMask");

// Compute canopy coverage
getStatistics(area, mean);
coverPercent = (mean / 255) * 100;

// ExG computation on original RGB
selectWindow("RGB");
run("Duplicate...", "title=ExGtemp");
// ExG = 2G - R - B (requires channel math; simplified here)
getStatistics(area, mean, min, max);
exgIndex = mean / 255;  // normalized proxy

// Texture variance (Local Standard Deviation)
selectImage(vStack);
run("Select All");
getStatistics(area, mean, min, max, stdDev);
textureVar = stdDev;

// Readiness: coverage-weighted with texture uniformity
readiness = (coverPercent / 100) * (1 - (textureVar / max));
if (readiness < 0) readiness = 0;
if (readiness > 1) readiness = 1;

// Output
run("Clear Results");
setResult("CanopyCover", 0, coverPercent);
setResult("GreenessIndex", 0, exgIndex);
setResult("TextureVariance", 0, textureVar);
setResult("ReadinessScore", 0, readiness);

updateResults();
print("✓ Microgreen analysis complete: " + d2s(coverPercent,1) + "% coverage, readiness=" + d2s(readiness,2));

// Cleanup
close("GreenMask");
close("ExGtemp");
