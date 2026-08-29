// CoSE FIJI Bench: Rosettes Preset
// Individual plant rosette morphology: area, shape, compactness

getDimensions(w, h, channels, slices, frames);
if (channels > 1) { run("Stack to RGB"); run("RGB Stack"); }
if (bitDepth() != 8) { run("8-bit"); }

// Convert to CIELAB; threshold on a* (green channel)
print("Converting to CIELAB...");
run("CIELAB Stack");
selectWindow("a*");

// Threshold to isolate green (positive a*)
setThreshold(5, 255);
run("Convert to Mask");

// Size gate: remove noise
print("Removing noise...");
run("Despeckle");
run("Open");

// Watershed to separate touching rosettes
print("Segmenting rosettes...");
run("Watershed");

// Analyze each rosette
print("Measuring rosettes...");
run("Analyze Particles...", "size=50-Infinity circularity=0.4-1.0 show=Outlines display clear include summarize");

// Results table now contains:
//   - Area, Perimeter, Circularity, Solidity, etc.
// Reformat into our standard schema

nResults = nResults;
for (i = 0; i < nResults; i++) {
  area = getResult("Area", i);
  perim = getResult("Perim.", i);
  circ = getResult("Circ.", i);
  compact = 1 - circ;

  setResult("Circularity", i, circ);
  setResult("Compactness", i, compact);
}

updateResults();
print("✓ Rosette analysis complete: " + nResults + " rosettes detected");
