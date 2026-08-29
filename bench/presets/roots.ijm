// CoSE FIJI Bench: Roots Preset
// Semi-automatic root system analysis via ridge enhancement + Otsu threshold + skeletonization
//
// Input: open image with root system
// Output: Results table with per-root measurements, ROI overlay

getDimensions(w, h, channels, slices, frames);
if (channels > 1) { run("Stack to RGB"); run("RGB Stack"); run("Grayscale"); }
if (bitDepth() != 8) { run("8-bit"); }

// Ridge/vessel enhancement to highlight thin root structures
print("Detecting root vessels...");
run("Ridge Detection", "line_width=2 high_contrast=500 lower_threshold=10 upper_threshold=255 extend_line show_results displayresults add_to_manager");

// Threshold to binary (Otsu is robust to lighting variations)
print("Thresholding...");
setAutoThreshold("Otsu dark");
run("Convert to Mask");

// Skeletonize to 1-px-wide paths
print("Skeletonizing...");
run("Skeletonize (2D/3D)");

// Analyze skeleton: branch points, path lengths, etc.
print("Analyzing skeleton topology...");
run("Analyze Skeleton (2D/3D)", "prune=none show display");

// The "Analyze Skeleton" plugin creates a Results table with:
//   - Skeleton ID
//   - Branch length
//   - Branch information
// We'll reformat this into our standard outputs

selectWindow("Results");
nResults = nResults;
if (nResults == 0) {
  print("WARNING: No skeleton branches detected. Image may have poor root visibility.");
}

// Compute aggregate statistics
totalLength = 0;
for (i = 0; i < nResults; i++) {
  val = getResult("Branch length", i);
  if (!isNaN(val)) totalLength += val;
}

// Get image bounds for convex hull estimate (approximation)
run("Select All");
getSelectionBounds(x, y, boxW, boxH);
run("Select None");
convexArea = (boxW * boxH); // rough estimate

// Compute lateral count (proxy: number of branch points)
// TODO: parse 3D skeleton report for accurate topology
lateralCount = nResults - 1; // approximate: each row is a branch

// Clear previous results and write our standardized output
run("Clear Results");
setResult("TotalLength", 0, totalLength);
setResult("LateralCount", 0, lateralCount);
setResult("MaxDepth", 0, h); // y-extent of image
setResult("LateralSpread", 0, w);
setResult("ConvexHullArea", 0, convexArea);
if (convexArea > 0) setResult("DensityPerMm", 0, totalLength / convexArea);

updateResults();

print("✓ Root analysis complete: " + totalLength + " mm total length, " + lateralCount + " laterals");
