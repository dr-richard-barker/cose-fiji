#!/bin/bash
set -e  # Exit on error

echo "================================================"
echo "Building ImageJ from source with patches"
echo "================================================"

# Configuration
IMAGEJ_COMMIT="49f2c64ab0f5da08b23d5208e15f71ee386c0c82"
IMAGEJ_REPO="https://github.com/imagej/ImageJ.git"
BUILD_DIR="ImageJ-build"
PATCH_DIR="imagej-patch"

# Clean up previous build
rm -rf "$BUILD_DIR"
rm -rf lib/ImageJ

# Clone ImageJ source at specific commit
echo "Cloning ImageJ source code..."
git clone "$IMAGEJ_REPO" "$BUILD_DIR"
cd "$BUILD_DIR"
git checkout "$IMAGEJ_COMMIT"

# Apply patches using Python script (more reliable than patch command)
echo "Applying patches..."
cd ..
python3 apply_patch.py
cd "$BUILD_DIR"

# Build ImageJ
echo "Building ImageJ..."
# ImageJ uses Ant for building
if ! command -v ant &> /dev/null; then
    echo "Error: Apache Ant is required but not installed."
    echo "Please install Ant: https://ant.apache.org/manual/install.html"
    echo "  macOS: brew install ant"
    echo "  Ubuntu: sudo apt-get install ant"
    exit 1
fi

ant build

# Create lib directory structure
cd ..
mkdir -p lib/ImageJ

# Copy built jar
if [ -f "$BUILD_DIR/ij.jar" ]; then
    echo "Copying built ImageJ jar..."
    cp "$BUILD_DIR/ij.jar" lib/ImageJ/
else
    echo "Error: ij.jar not found after build"
    exit 1
fi

# Build threadhack parallel-tool.jar against the freshly-built ij.jar
# (so com.hack.viewer.LazyImagePlus can compile against ImagePlus etc.)
echo "Building threadhack parallel-tool.jar..."
IJ_JAR="$(pwd)/lib/ImageJ/ij.jar" bash threadhack/java/build.sh

# Copy other necessary files
echo "Copying ImageJ resources..."
if [ -d "$BUILD_DIR/plugins" ]; then
    cp -r "$BUILD_DIR/plugins" lib/ImageJ/
fi
if [ -d "$BUILD_DIR/macros" ]; then
    cp -r "$BUILD_DIR/macros" lib/ImageJ/
fi
if [ -d "$BUILD_DIR/luts" ]; then
    cp -r "$BUILD_DIR/luts" lib/ImageJ/
fi
if [ -d "$BUILD_DIR/images" ]; then
    cp -r "$BUILD_DIR/images" lib/ImageJ/
fi

# Download additional plugins from manifest
echo "Downloading additional plugins..."
if [ -f plugins_manifest.txt ]; then
    mkdir -p lib/ImageJ/plugins
    while IFS=: read -r filename url; do
        # Skip empty lines and comments
        [[ -z "$filename" || "$filename" =~ ^#.*$ ]] && continue
        echo "  Downloading $filename from $url"
        curl -L "$url" -o "lib/ImageJ/plugins/$filename"
    done < plugins_manifest.txt
fi

# --- CoSE addition: SmartRoot -------------------------------------------
# SmartRoot (Lobet / Draye, GPL-3.0) ships only as a zip, so it cannot go in
# plugins_manifest.txt. Fetch and unpack the jars into their own plugins
# subdirectory, which is what puts SmartRoot under the Plugins menu. The MySQL
# driver is then deleted and a browser-appropriate entry point compiled in --
# see the two blocks below for why.
echo "Fetching SmartRoot..."
SR_URL="https://raw.githubusercontent.com/SmartRoot/SmartRoot-Installation/master/SmartRoot.zip"
SR_TMP="$(mktemp -d)"
if curl -fsSL "$SR_URL" -o "$SR_TMP/SmartRoot.zip"; then
  unzip -qo "$SR_TMP/SmartRoot.zip" -x "__MACOSX/*" -d "$SR_TMP"
  mkdir -p lib/ImageJ/plugins/SmartRoot
  cp "$SR_TMP"/SmartRoot/SmartRoot/*.jar lib/ImageJ/plugins/SmartRoot/

  # Drop the MySQL JDBC driver. SmartRoot's SR.initialize() calls
  # SQLServer.start() -> Class.forName("com.mysql.jdbc.Driver"). With the jar
  # present CheerpJ resolves the driver's dependency graph class-by-class over
  # HTTP, issuing two 404s per class across hundreds of classes, which hangs
  # startup indefinitely. With the jar absent Class.forName throws
  # ClassNotFoundException immediately and SQLServer.start()'s existing catch
  # block logs "you will not be able to write to a database" and returns. The
  # browser has no raw TCP so that export path could never work anyway; RSML is
  # the export route.
  rm -f lib/ImageJ/plugins/SmartRoot/mysql-connector-*.jar

  # Build the bench's SmartRoot entry point (see smartroot-patch/ for why).
  if [ -d ../smartroot-patch ] || [ -d smartroot-patch ]; then
    SRC_DIR="smartroot-patch"; [ -d "$SRC_DIR" ] || SRC_DIR="../smartroot-patch"
    echo "  Compiling SmartRoot bench entry point..."
    SR_CP="lib/ImageJ/ij.jar:lib/ImageJ/plugins/SmartRoot/Smart_Root.jar:lib/ImageJ/plugins/SmartRoot/Image_Explorer.jar"
    SR_OUT="$(mktemp -d)"
    if javac -nowarn -source 8 -target 8 -cp "$SR_CP" -d "$SR_OUT" "$SRC_DIR"/*.java 2>&1; then
      cp "$SRC_DIR/plugins.config" "$SR_OUT/plugins.config"
      (cd "$SR_OUT" && jar cf SR_Bench_.jar .)
      mv "$SR_OUT/SR_Bench_.jar" lib/ImageJ/plugins/SmartRoot/
      echo "    built SR_Bench_.jar"
    else
      echo "    WARNING: SmartRoot patch failed to compile; stock SmartRoot only" >&2
    fi
    rm -rf "$SR_OUT"
  fi

  echo "  SmartRoot jars: $(ls lib/ImageJ/plugins/SmartRoot | tr '\n' ' ')"
else
  echo "  WARNING: could not fetch SmartRoot; the roots preset still works but" >&2
  echo "  interactive tracing will be unavailable." >&2
fi
rm -rf "$SR_TMP"

# Create index.list files for subdirectories
echo "Creating index.list files..."
dirs=("lib/ImageJ/plugins" "lib/ImageJ/luts" "lib/ImageJ/macros")

for dir in "${dirs[@]}"; do
    if [[ -d "$dir" ]]; then
        find "$dir" -type d | while read -r child_dir; do
            ls "$child_dir" | grep -v "^index\.list$" > "$child_dir/index.list" 2>/dev/null || true
        done
    fi
done

# Clean up build directory
echo "Cleaning up build directory..."
rm -rf "$BUILD_DIR"

echo "================================================"
echo "Build complete!"
echo "ImageJ jar: lib/ImageJ/ij.jar"
echo "================================================"
