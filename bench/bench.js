/**
 * CoSE FIJI Bench — image + calibration handoff, preset runner, FAIR export.
 *
 * URL contract:
 *   ?open=<image url>      CORS-readable image to analyse
 *   &scale=<px per mm>     from the AstroBotany ArUco marker; omit => pixels
 *   &unit=mm               unit label for the scale (default mm)
 *   &preset=<name>         one of bench/presets/*.json
 *   &ref=<uuid>            AstroBotany entry id, recorded in provenance
 *   &embed=1               hosted inside the database shell
 *
 * Two things about this CheerpJ build drive the design:
 *  1. It is single-threaded. Any macro that opens a modal dialog freezes the
 *     whole JVM with no way back except a click, so macros are validated before
 *     they run and errors surface in our own UI rather than ImageJ's.
 *  2. ImageJ boots in ~45 s. Nothing may assume window.IJ exists at load.
 */

import { FAIRExporter } from './fair.js';
import { sha256Hex } from './zip.js';

const PRESET_IDS = ['roots', 'rows', 'rosettes', 'petri-seedlings', 'microgreen-canopy', 'duckweed'];

class FIJIBench {
  constructor() {
    const q = new URLSearchParams(location.search);
    this.params = {
      open: q.get('open'),
      scale: q.get('scale'),
      unit: q.get('unit') || 'mm',
      preset: q.get('preset'),
      ref: q.get('ref'),
      embed: q.get('embed') === '1',
    };
    this.image = null;
    this.scale = null;
    this.preset = null;
    this.lastRun = null;
    this.el = null;
  }

  // ---- ImageJ plumbing ---------------------------------------------------

  async waitForImageJ(timeoutMs = 180000) {
    const t0 = Date.now();
    while (typeof window.IJ !== 'function') {
      if (Date.now() - t0 > timeoutMs) throw new Error('ImageJ did not finish booting');
      await new Promise(r => setTimeout(r, 400));
    }
  }

  /**
   * Run a macro and return its value.
   *
   * Deliberately uses IJ.runMacro rather than the patched
   * Interpreter.runMacroSilent. Measured behaviour in this build:
   *
   *   command                     IJ.runMacro   runMacroSilent
   *   Set Scale...                applies       silently ignored
   *   Subtract Background...      applies       silently ignored (no-op)
   *   Analyze Particles...        2 of 2        1 of 2 (wrong)
   *
   * ImageJ feeds a command's options string to its dialog through a
   * thread-local (Macro.setOptions); the silent interpreter runs on a different
   * thread, so every dialog-driven command falls back to stale defaults. Silent
   * mode is therefore unusable for real analysis — it fails quietly, which is
   * worse than failing loudly.
   *
   * The cost is that a macro *error* opens a modal dialog and wedges this
   * single-threaded JVM. Hence the watchdog: we surface an actionable message
   * rather than hanging forever.
   */
  async macro(src, { timeoutMs = 120000 } = {}) {
    let timer;
    const watchdog = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(
        'ImageJ stopped responding. This usually means a macro raised an error '
        + 'and ImageJ is showing a modal dialog behind this panel. Dismiss it, '
        + 'or reload the page.'
      )), timeoutMs);
    });
    try {
      return await Promise.race([window.IJ.runMacro(src), watchdog]);
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- image staging -----------------------------------------------------

  async stageImage(url) {
    const filename = (decodeURIComponent(url.split('/').pop() || '').split('?')[0]) || 'image.tif';
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error(`fetching image: HTTP ${resp.status}`);
    const buf = new Uint8Array(await resp.arrayBuffer());

    await window.localFS.addFile(new File([buf], filename), filename);
    this.image = { url, filename, bytes: buf.length, sha256: await sha256Hex(buf) };
    return this.image;
  }

  /** Open the staged image and apply Set Scale. */
  async openAndScale() {
    const { filename } = this.image;
    const pxPerMm = this.params.scale ? parseFloat(this.params.scale) : null;
    const unit = this.params.unit;

    let src = `close("*"); open("/local/${filename}");`;
    if (pxPerMm && isFinite(pxPerMm) && pxPerMm > 0) {
      // setVoxelSize, not run("Set Scale..."): it is a plain macro function with
      // no dialog, so it cannot be defeated by macro-option plumbing, and it
      // overrides any spatial calibration the file carries. Several of the TIFFs
      // in this collection declare their own inch-based resolution, which
      // Set Scale was leaving in place — every length then came out in inches
      // while still being labelled mm.
      const mmPerPx = 1 / pxPerMm;
      src += ` setVoxelSize(${mmPerPx}, ${mmPerPx}, 1, "${unit}");`;
      this.scale = { pxPerMm, unit, source: 'astrobotany-aruco-marker' };
    } else {
      this.scale = { pxPerMm: null, unit: 'pixel', source: 'none' };
    }
    src += ` return getTitle();`;
    await this.macro(src);

    // getTitle() through runMacro is unreliable in this build, so read the
    // opened image's real dimensions back instead of trusting a return value.
    const dims = await this.macro(
      'getPixelSize(u,pw,ph); return ""+getWidth()+"|"+getHeight()+"|"+u+"|"+pw;'
    );
    const [w, h, u, pw] = String(dims).split('|');
    this.opened = { width: +w, height: +h, unit: u, pixelWidth: +pw };
    return this.opened;
  }

  // ---- presets -----------------------------------------------------------

  async loadPreset(name) {
    if (!PRESET_IDS.includes(name)) throw new Error(`unknown preset "${name}"`);
    const base = new URL('./presets/', import.meta.url);
    const [descResp, macroResp] = await Promise.all([
      fetch(new URL(`${name}.json`, base)),
      fetch(new URL(`${name}.ijm`, base)),
    ]);
    if (!descResp.ok) throw new Error(`preset descriptor ${name}.json: HTTP ${descResp.status}`);
    if (!macroResp.ok) throw new Error(`preset macro ${name}.ijm: HTTP ${macroResp.status}`);
    this.preset = await descResp.json();
    this.preset.macroSource = await macroResp.text();
    return this.preset;
  }

  async runPreset() {
    if (!this.preset) throw new Error('no preset loaded');
    if (!this.image) throw new Error('no image opened');

    const t0 = Date.now();
    await this.macro(this.preset.macroSource);
    const rows = await this.readResults();
    const log = await this.readLog();
    this.lastRun = { rows, log, ms: Date.now() - t0 };
    return this.lastRun;
  }

  /**
   * Read the ImageJ Results table into plain objects.
   * Serialised through the macro language as TSV — reading the Java ResultsTable
   * across the CheerpJ bridge row by row is far slower and no more reliable.
   */
  async readResults() {
    const tsv = await this.macro(`
      if (nResults == 0) return "";
      cols = split(String.getResultsHeadings, "\\t");
      out = "";
      first = true;
      for (c = 0; c < cols.length; c++) {
        h = String.trim(cols[c]);
        if (h == "") continue;
        if (!first) out = out + "\\t";
        out = out + h; first = false;
      }
      for (r = 0; r < nResults; r++) {
        out = out + "\\n"; first = true;
        for (c = 0; c < cols.length; c++) {
          h = String.trim(cols[c]);
          if (h == "") continue;
          if (!first) out = out + "\\t";
          out = out + getResultString(h, r); first = false;
        }
      }
      return out;
    `);
    const text = String(tsv || '').trim();
    if (!text) return [];

    const [head, ...body] = text.split('\n');
    const cols = head.split('\t');
    return body.map(line => {
      const cells = line.split('\t');
      const row = {};
      cols.forEach((c, i) => {
        const raw = cells[i] ?? '';
        const n = Number(raw);
        row[c] = (raw !== '' && isFinite(n)) ? n : raw;
      });
      return row;
    });
  }

  async readLog() {
    try { return String((await this.macro('return getInfo("log");')) || ''); }
    catch { return ''; }
  }

  async softwareInfo() {
    let imagej = null;
    try { imagej = String(await this.macro('return getVersion();')); } catch {}
    return {
      imagej,
      cheerpj: '4.2',
      plugins: [{ name: 'SmartRoot', licence: 'GPL-3.0', source: 'https://github.com/SmartRoot/smartroot' }],
    };
  }

  // ---- export ------------------------------------------------------------

  async exportFAIR() {
    if (!this.lastRun) throw new Error('run an analysis first');
    const exporter = new FAIRExporter({
      preset: this.preset,
      macro: this.preset.macroSource,
      rows: this.lastRun.rows,
      image: this.image,
      scale: this.scale,
      log: this.lastRun.log,
      software: await this.softwareInfo(),
      ref: this.params.ref,
    });
    return await exporter.download();
  }

  // ---- UI ----------------------------------------------------------------

  ui() {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.id = 'cose-bench';
    el.innerHTML = `
      <style>
        #cose-bench{position:fixed;top:0;right:0;width:290px;max-height:100vh;overflow:auto;
          font:13px/1.45 system-ui,-apple-system,sans-serif;background:#fbfbfd;color:#14151a;
          border-left:1px solid #d6d8e0;box-shadow:-2px 0 10px rgba(0,0,0,.06);z-index:99999;padding:14px}
        #cose-bench h2{font-size:13px;margin:0 0 10px;letter-spacing:.02em;text-transform:uppercase;color:#5a5f70}
        #cose-bench select,#cose-bench button{width:100%;padding:7px 9px;margin:4px 0;border-radius:6px;
          border:1px solid #c8cbd6;background:#fff;font:inherit}
        #cose-bench button{background:#2f6f4f;color:#fff;border-color:#2f6f4f;cursor:pointer;font-weight:600}
        #cose-bench button:disabled{background:#c3c7d1;border-color:#c3c7d1;cursor:default}
        #cose-bench button.sec{background:#fff;color:#2f6f4f}
        #cose-bench .m{color:#5a5f70;font-size:12px}
        #cose-bench .warn{background:#fff5e6;border:1px solid #e8c48a;padding:7px 9px;border-radius:6px;font-size:12px}
        #cose-bench .err{background:#fdecec;border:1px solid #e2a3a3;padding:7px 9px;border-radius:6px;font-size:12px;white-space:pre-wrap}
        #cose-bench table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
        #cose-bench td{padding:2px 0;border-bottom:1px solid #ebedf2}
        #cose-bench td:last-child{text-align:right;font-variant-numeric:tabular-nums}
      </style>
      <h2>CoSE FIJI Bench</h2>
      <div id="cb-scale"></div>
      <select id="cb-preset">${PRESET_IDS.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
      <button id="cb-run" disabled>Run analysis</button>
      <button id="cb-exp" class="sec" disabled>Export FAIR bundle</button>
      <div id="cb-out" class="m"></div>`;
    document.body.appendChild(el);
    this.el = el;

    el.querySelector('#cb-run').onclick = () => this.onRun();
    el.querySelector('#cb-exp').onclick = () => this.onExport();
    if (this.params.preset) el.querySelector('#cb-preset').value = this.params.preset;
    return el;
  }

  say(html, cls = 'm') {
    const out = this.el?.querySelector('#cb-out');
    if (out) { out.className = cls; out.innerHTML = html; }
  }

  async onRun() {
    const btn = this.el.querySelector('#cb-run');
    btn.disabled = true;
    try {
      const name = this.el.querySelector('#cb-preset').value;
      this.say('Loading preset…');
      await this.loadPreset(name);
      this.say(`Running <b>${this.preset.title}</b>…`);
      const { rows, ms } = await this.runPreset();
      if (!rows.length) {
        this.say('Analysis produced no rows. The image may not suit this preset.', 'warn');
      } else {
        const first = rows[0];
        const cells = Object.entries(first)
          .filter(([k]) => !['Label', 'Unit', 'Calibrated', ' '].includes(k))
          .slice(0, 8)
          .map(([k, v]) => `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toFixed(3) : v}</td></tr>`)
          .join('');
        this.say(`<b>${rows.length}</b> row(s) in ${ms} ms<table>${cells}</table>`);
        this.el.querySelector('#cb-exp').disabled = false;
      }
    } catch (e) {
      this.say(`Analysis failed:\n${e.message || e}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async onExport() {
    try {
      this.say('Building bundle…');
      const name = await this.exportFAIR();
      this.say(`Downloaded <b>${name}</b>`);
    } catch (e) {
      this.say(`Export failed:\n${e.message || e}`, 'err');
    }
  }

  scaleBanner() {
    const box = this.el.querySelector('#cb-scale');
    if (this.scale?.pxPerMm) {
      const mm = (this.opened.width * this.opened.pixelWidth).toFixed(1);
      const mmh = (this.opened.height * this.opened.pixelWidth).toFixed(1);
      box.innerHTML = `<div class="m">Calibrated <b>${this.scale.pxPerMm} px/${this.scale.unit}</b><br>
        Field of view ${mm} × ${mmh} ${this.scale.unit}</div>`;
    } else {
      box.innerHTML = `<div class="warn"><b>Uncalibrated.</b> No scale supplied, so results
        are in pixels, not ${this.params.unit}.</div>`;
    }
  }

  // ---- boot --------------------------------------------------------------

  async init() {
    this.ui();
    this.say('Waiting for ImageJ to boot (~45 s on first load)…');
    try {
      await this.waitForImageJ();
    } catch (e) {
      this.say(String(e.message || e), 'err');
      return;
    }

    if (!this.params.open) {
      this.say('Open an image (File ▸ Open, or drag one in), then choose a preset.');
      this.el.querySelector('#cb-run').disabled = false;
      return;
    }

    try {
      this.say('Fetching image…');
      await this.stageImage(this.params.open);
      this.say('Opening in ImageJ…');
      await this.openAndScale();
      this.scaleBanner();
      this.el.querySelector('#cb-run').disabled = false;
      this.say(`Loaded <b>${this.image.filename}</b> (${this.opened.width}×${this.opened.height} px).`
             + ` Choose a preset and run.`);
      if (this.params.preset) await this.onRun();
    } catch (e) {
      this.say(`Could not load the image:\n${e.message || e}`, 'err');
    }
  }
}

const bench = new FIJIBench();
window.FIJIBench = bench;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bench.init());
} else {
  bench.init();
}
