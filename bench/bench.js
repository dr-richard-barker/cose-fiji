/**
 * CoSE FIJI Bench – URL Parameter Handler & Image Pipeline
 *
 * Parses query parameters (?open=…&scale=…&preset=…) and orchestrates:
 *   1. Remote image fetch → localFS
 *   2. ImageJ.open() + Set Scale (silent macro)
 *   3. Preset launcher UI
 *   4. FAIR export on completion
 *
 * Designed to run AFTER window.IJ is available (~45s).
 */

class FIJIBench {
  constructor() {
    this.params = this.parseParams();
    this.image = null;      // { url, filename, bytes }
    this.scale = null;      // { pxPerMm, unit, source }
    this.preset = null;     // active preset name
    this.analysisId = null; // ref UUID for round-tripping results
    this.embed = this.params.embed === '1';
  }

  parseParams() {
    const q = new URLSearchParams(window.location.search);
    return {
      open: q.get('open'),           // image URL (required for analysis)
      scale: q.get('scale'),         // px/mm from ArUco marker
      unit: q.get('unit') || 'mm',   // measurement unit
      preset: q.get('preset'),       // assay preset (roots, rows, rosettes…)
      ref: q.get('ref'),             // AstroBotany entry UUID (for bookkeeping)
      embed: q.get('embed'),         // '1' = hide ImageJ chrome
    };
  }

  /**
   * Stage an image: fetch from URL → store in localFS.
   * @param {string} url – CORS-enabled image URL
   * @returns {Promise<{filename, bytes, url}>}
   */
  async stageImage(url) {
    if (!url) throw new Error('No image URL provided (?open=…)');

    // Infer filename from URL (everything after last /)
    const filename = decodeURIComponent(url.split('/').pop().split('?')[0]) || 'image.tif';

    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();

      // Add to localFS so ImageJ can see it
      const file = new File([blob], filename, { type: blob.type });
      await window.localFS.addFile(file, filename);

      this.image = { url, filename, bytes: blob.size };
      return this.image;
    } catch (err) {
      throw new Error(`Failed to fetch image: ${err.message}`);
    }
  }

  /**
   * Open image in ImageJ + apply scale.
   * Uses runMacroSilent to avoid modal dialogs that freeze the JVM.
   * @returns {Promise<string>} – image title as reported by ImageJ
   */
  async openAndScale() {
    if (!this.image) throw new Error('No image staged');
    if (!window.IJ) throw new Error('ImageJ not ready');

    const { filename } = this.image;
    const { scale, unit } = this.params;

    // Build a silent macro that:
    //   1. Opens the image
    //   2. Sets scale (if provided)
    //   3. Returns the title
    let macro = `open("/local/${filename}"); `;

    if (scale) {
      // scale param is px/mm; Set Scale wants distance (in pixels) + known (in mm)
      // E.g., ?scale=0.0265 means 0.0265 mm/px, so 1 mm = 37.8 px
      const pxPerMm = parseFloat(scale);
      const pxPerMmReciprocal = (1 / pxPerMm).toFixed(1);
      macro += `run("Set Scale...", "distance=${pxPerMmReciprocal} known=1 unit=${unit}"); `;
      this.scale = { pxPerMm, unit, source: 'aruco-marker' };
    } else {
      this.scale = { pxPerMm: null, unit, source: 'none' };
    }

    macro += `return getTitle();`;

    try {
      const title = await this.runMacroSilent(macro);
      if (!title) throw new Error('Failed to open image');
      return title;
    } catch (err) {
      throw new Error(`Image open/scale failed: ${err.message}`);
    }
  }

  /**
   * Invoke a macro via the patched Interpreter.runMacroSilent() if available.
   * Falls back to IJ.runMacro() if the silent API is not available.
   * @param {string} macro – ImageJ macro code
   * @returns {Promise<string>} – macro result
   */
  async runMacroSilent(macro) {
    if (typeof window.Interpreter !== 'undefined' &&
        typeof window.Interpreter.runMacroSilent === 'function') {
      // Use patched silent API (no dialogs)
      try {
        const result = await window.Interpreter.runMacroSilent(macro);
        return Array.isArray(result) ? result[0] : result;
      } catch (err) {
        console.warn('Interpreter.runMacroSilent failed, falling back:', err);
      }
    }

    // Fallback: use IJ.runMacro (may throw if dialogs appear)
    return await window.IJ.runMacro(macro);
  }

  /**
   * Load a preset module (.ijm file + .json descriptor).
   * Presets are defined as { name, macro, params, outputs, method }.
   * @param {string} presetName – e.g., 'roots', 'rows', 'rosettes'
   * @returns {Promise<Object>} – preset definition
   */
  async loadPreset(presetName) {
    if (!presetName) throw new Error('No preset specified (?preset=…)');

    try {
      // Load preset JSON descriptor
      const resp = await fetch(`./presets/${presetName}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const preset = await resp.json();

      // Load the macro code
      const macroResp = await fetch(`./presets/${presetName}.ijm`);
      if (!macroResp.ok) throw new Error(`Macro HTTP ${macroResp.status}`);
      preset.macroSource = await macroResp.text();

      this.preset = preset;
      return preset;
    } catch (err) {
      throw new Error(`Failed to load preset '${presetName}': ${err.message}`);
    }
  }

  /**
   * Run the active preset and collect results.
   * @returns {Promise<Object>} – { measurements, roi, log }
   */
  async runPreset() {
    if (!this.preset) throw new Error('No preset loaded');
    if (!this.image) throw new Error('No image opened');

    try {
      // Macro should leave measurements in the Results table and any ROI
      const result = await this.runMacroSilent(this.preset.macroSource);

      // Collect outputs: measurements table, ROI, ImageJ log
      const measurements = await this.getResults();
      const roi = await this.getROI();
      const log = await this.getLog();

      return { measurements, roi, log, result };
    } catch (err) {
      throw new Error(`Preset execution failed: ${err.message}`);
    }
  }

  /**
   * Fetch the ImageJ Results table (Analyze Particles output, etc.).
   * @returns {Promise<Array>} – array of measurement objects
   */
  async getResults() {
    // TODO: Call IJ.getResults() if available, or parse from the Results window
    // For now, return placeholder
    return [];
  }

  /**
   * Fetch any ROI drawn on the active image.
   * @returns {Promise<Object|null>} – GeoJSON feature or null
   */
  async getROI() {
    // TODO: Call IJ.getSelection() and convert to GeoJSON
    return null;
  }

  /**
   * Fetch the ImageJ log (macro output).
   * @returns {Promise<string>}
   */
  async getLog() {
    // TODO: Call IJ.getLog() or equivalent
    return '';
  }

  /**
   * Initialize: wait for ImageJ, stage image, open & scale, show preset picker.
   * Called once on page load.
   */
  async init() {
    // Wait for ImageJ to boot
    await this.waitForImageJ(60000);  // 60s timeout

    // If no image URL provided, show launcher UI
    if (!this.params.open) {
      this.showLauncher();
      return;
    }

    // Stage image and open in ImageJ
    try {
      await this.stageImage(this.params.open);
      const title = await this.openAndScale();
      console.log(`✓ Opened: ${title}`);

      // If preset specified, load and run it
      if (this.params.preset) {
        await this.loadPreset(this.params.preset);
        this.showPresetUI();
      } else {
        this.showPresetPicker();
      }
    } catch (err) {
      this.showError(`Setup failed: ${err.message}`);
    }
  }

  /**
   * Poll for window.IJ to become available.
   * @param {number} timeoutMs – max wait time
   * @throws – if ImageJ doesn't boot in time
   */
  async waitForImageJ(timeoutMs = 60000) {
    const start = Date.now();
    while (!window.IJ || typeof window.IJ !== 'function') {
      if (Date.now() - start > timeoutMs) {
        throw new Error('ImageJ boot timeout');
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  /**
   * UI: Show launcher/preset picker (when no image is auto-loaded).
   */
  showLauncher() {
    // Placeholder: would render a preset picker + drag-drop UI
    console.log('Launcher: ready for image input');
  }

  /**
   * UI: Show preset-specific controls + run button.
   */
  showPresetUI() {
    // Placeholder: would show the preset's description + parameter fields
    console.log(`Preset UI for: ${this.preset.name}`);
  }

  /**
   * UI: Show preset picker (when no preset is specified in URL).
   */
  showPresetPicker() {
    // Placeholder: would list all six presets with descriptions
    console.log('Preset picker: available presets');
  }

  /**
   * UI: Show error message.
   */
  showError(msg) {
    console.error(`❌ ${msg}`);
    // TODO: render error UI
  }
}

// Initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const bench = new FIJIBench();
    bench.init().catch(err => console.error('Bench init failed:', err));
    window.FIJIBench = bench;  // expose for debugging
  });
} else {
  const bench = new FIJIBench();
  bench.init().catch(err => console.error('Bench init failed:', err));
  window.FIJIBench = bench;
}
