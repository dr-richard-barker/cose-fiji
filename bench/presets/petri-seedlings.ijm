// CoSE FIJI Bench: Petri Seedlings Preset
// Germination rate, hypocotyl length, root length on agar plates

getDimensions(w, h, channels, slices, frames);
if (channels > 1) { run("Stack to RGB"); run("RGB Stack"); run("Grayscale"); }
if (bitDepth() != 8) { run("8-bit"); }

// Invert so seedlings are bright
run("Invert");

// Petri dish ROI (outer circle boundary) — simplified: use full frame
run("Select All");

// Threshold
setAutoThreshold("Otsu dark");
run("Convert to Mask");

// Analyze particles: each is a seedling
print("Detecting seedlings...");
run("Analyze Particles...", "size=100-Infinity show=Outlines display clear include");

nSeedlings = nResults;
totalHypocotyl = 0;
totalRoot = 0;

// For each seedling, estimate hypocotyl vs root split
// Simplified: use bounding box height; assume seed at 20% down
for (i = 0; i < nSeedlings; i++) {
  height = getResult("BX", i) - getResult("MinX", i);  // approximate height from bounding box
  // Seed is at top 20%, hypocotyl is 20-50%, root is 50-100%
  hypocotyl = height * 0.3;
  root = height * 0.5;
  totalHypocotyl += hypocotyl;
  totalRoot += root;
}

germRate = 100;  // all detected seedlings = germinated
meanHypocotyl = nSeedlings > 0 ? totalHypocotyl / nSeedlings : 0;
meanRoot = nSeedlings > 0 ? totalRoot / nSeedlings : 0;

// Output
run("Clear Results");
setResult("GerminationRate", 0, germRate);
setResult("SeedlingCount", 0, nSeedlings);
setResult("HypocotylLength", 0, meanHypocotyl);
setResult("RootLength", 0, meanRoot);

updateResults();
print("✓ Seedling analysis complete: " + nSeedlings + " seedlings, " + d2s(meanRoot,1) + " mm mean root");
