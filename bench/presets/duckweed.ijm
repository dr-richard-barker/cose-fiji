// CoSE FIJI Bench: Duckweed Preset
// Frond count, area, relative growth rate (RGR)

getDimensions(w, h, channels, slices, frames);
if (channels > 1) { run("Stack to RGB"); run("RGB Stack"); }
if (bitDepth() != 8) { run("8-bit"); }

// HSV for green detection
print("Detecting duckweed fronds...");
run("HSV Stack");
selectWindow("H");
setThreshold(90, 150);  // green hue
run("Convert to Mask");
run("Dilate");
run("Close");

// Watershed to separate touching fronds
run("Watershed");

// Analyze particles: each frond
run("Analyze Particles...", "size=5-Infinity show=Outlines display clear include summarize");

nFronds = nResults;
totalArea = 0;
for (i = 0; i < nFronds; i++) {
  area = getResult("Area", i);
  totalArea += area;
}

meanFrondArea = nFronds > 0 ? totalArea / nFronds : 0;

// RGR: if a previous analysis exists in metadata (not yet implemented),
// compute RGR = ln(current_area / previous_area) / days
// For now, output 0 as placeholder
rgr = 0;

// Output
run("Clear Results");
setResult("FrondCount", 0, nFronds);
setResult("TotalArea", 0, totalArea);
setResult("MeanFrondArea", 0, meanFrondArea);
setResult("RGR", 0, rgr);

updateResults();
print("✓ Duckweed analysis complete: " + nFronds + " fronds, " + d2s(totalArea,1) + " mm² total");
