/**
 * CoSE FIJI Bench — FAIR export bundle.
 *
 * Packages one analysis into a .zip that a third party can actually re-run:
 *   measurements.csv          tidy, one row per measured object, units in header
 *   dataset.json              MIAPPE v1.2-aligned study/variable metadata
 *   provenance.json           image + macro SHA-256, scale and where it came from
 *   analysis.ijm              the exact macro that produced the numbers
 *   roots.rsml                RSML root trace (roots preset only)
 *   ro-crate-metadata.json    RO-Crate 1.1 wrapper
 *   README.md, LICENSE        method notes + CC-BY-4.0
 *
 * Every hash is computed for real. Nothing in this bundle is a placeholder: if a
 * value is unknown it is written as null and the README says so, because a
 * provenance file that invents its own checksums is worse than none.
 */

import { makeZip, sha256Hex } from './zip.js';

export class FAIRExporter {
  /**
   * @param {object} ctx
   * @param {object} ctx.preset    preset descriptor (from presets/<name>.json)
   * @param {string} ctx.macro     macro source actually executed
   * @param {Array}  ctx.rows      measurement rows (array of plain objects)
   * @param {object} ctx.image     { url, filename, bytes, sha256 }
   * @param {object} ctx.scale     { pxPerMm, unit, source }
   * @param {string} ctx.log       ImageJ log text
   * @param {object} ctx.software  { imagej, cheerpj, plugins[] }
   * @param {string} ctx.ref       AstroBotany entry uuid, if launched from there
   */
  constructor(ctx) {
    Object.assign(this, ctx);
    this.createdAt = new Date().toISOString();
    this.bundleId = (crypto.randomUUID && crypto.randomUUID()) || `fiji-${Date.now()}`;
  }

  // ---- measurements.csv --------------------------------------------------
  // Column headers carry units, e.g. "TotalLength (mm)", so a downstream reader
  // never has to guess whether a number is pixels or millimetres.
  csv() {
    const rows = this.rows || [];
    if (!rows.length) return 'no_measurements\n';

    const unitFor = {};
    for (const o of (this.preset.outputs || [])) unitFor[o.name] = o.unit;

    const cols = Object.keys(rows[0]);
    const header = cols.map(c => (unitFor[c] ? `${c} (${unitFor[c]})` : c));
    const esc = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [header.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n';
  }

  // ---- dataset.json (MIAPPE v1.2) ---------------------------------------
  miappe() {
    return JSON.stringify({
      miappeVersion: '1.2',
      investigation: {
        title: `${this.preset.title} — CoSE FIJI Bench`,
        description: this.preset.description,
        submissionDate: this.createdAt.slice(0, 10),
        license: 'CC-BY-4.0',
      },
      study: {
        studyIdentifier: this.bundleId,
        studyTitle: `${this.preset.title} of ${this.image?.filename || 'image'}`,
        observationUnitDescription: this.preset.dataType,
        // MIAPPE asks where the material came from. We only honestly know the
        // source image, so that is what we assert — not an invented accession.
        sourceImage: this.image?.url || null,
        astrobotanyEntry: this.ref || null,
      },
      observedVariables: (this.preset.outputs || []).map(o => ({
        variableName: o.name,
        traitName: o.label,
        traitDescription: o.description,
        unitName: o.unit,
        // Ontology terms are only emitted where the preset actually carries one.
        traitOntologyTerm: o.ontologyTerm || null,
        method: this.preset.method,
      })),
      dataFiles: [
        { fileName: 'measurements.csv', fileFormat: 'text/csv', fileDescription: 'Per-object measurements' },
      ],
    }, null, 2);
  }

  // ---- provenance.json ---------------------------------------------------
  provenance() {
    return JSON.stringify({
      bundleId: this.bundleId,
      createdAt: this.createdAt,
      image: {
        url: this.image?.url ?? null,
        filename: this.image?.filename ?? null,
        byteLength: this.image?.bytes ?? null,
        sha256: this.image?.sha256 ?? null,
      },
      // scaleSource is the load-bearing field: "none" means every length in
      // measurements.csv is in pixels and must not be reported as millimetres.
      scale: {
        pixelsPerMm: this.scale?.pxPerMm ?? null,
        unit: this.scale?.unit ?? 'pixel',
        scaleSource: this.scale?.source ?? 'none',
      },
      analysis: {
        preset: this.preset.name,
        presetTitle: this.preset.title,
        macroFile: 'analysis.ijm',
        macroSha256: this.macroSha ?? null,
        method: this.preset.method,
      },
      software: {
        imagej: this.software?.imagej ?? null,
        cheerpj: this.software?.cheerpj ?? null,
        bench: 'CoSE FIJI Bench 1.0',
        plugins: this.software?.plugins ?? [],
      },
    }, null, 2);
  }

  // ---- RSML (roots only) -------------------------------------------------
  // Emitted only when the macro produced root metrics. This carries measured
  // properties, not a fabricated polyline: geometry comes from SmartRoot
  // tracing, and claiming coordinates we never computed would corrupt the
  // downstream RSML consumers (AstroRoot dashboard, RSML R/Python readers).
  rsml() {
    const r = (this.rows && this.rows[0]) || {};
    const num = v => (v === undefined || v === null || v === '' ? null : Number(v));
    return `<?xml version="1.0" encoding="UTF-8"?>
<rsml xmlns:po="http://www.plantontology.org/xml-dtd/po.dtd">
  <metadata>
    <version>1</version>
    <unit>${this.scale?.unit || 'pixel'}</unit>
    <resolution>${this.scale?.pxPerMm ?? 1}</resolution>
    <last-modified>${this.createdAt}</last-modified>
    <software>CoSE FIJI Bench</software>
    <image><label>${this.image?.filename || ''}</label><sha256>${this.image?.sha256 || ''}</sha256></image>
    <property-definitions>
      <property-definition><label>length</label><type>float</type><unit>${this.scale?.unit || 'pixel'}</unit></property-definition>
      <property-definition><label>area</label><type>float</type></property-definition>
    </property-definitions>
  </metadata>
  <scene>
    <plant ID="plant-1" label="${this.image?.filename || 'plant'}">
      <root ID="rootsystem-1" label="whole root system" po:accession="PO:0025025">
        <properties>
          <length>${num(r.TotalLength)}</length>
          <area>${num(r.RootSystemArea)}</area>
          <maximum-depth>${num(r.MaxDepth)}</maximum-depth>
          <lateral-spread>${num(r.LateralSpread)}</lateral-spread>
          <convex-hull-area>${num(r.ConvexHullArea)}</convex-hull-area>
          <root-length-density>${num(r.RootLengthDensity)}</root-length-density>
        </properties>
        <!-- No <geometry> element: this preset measures the skeleton in
             aggregate and does not trace individual root polylines. Trace with
             Plugins > SmartRoot > SR Explorer to produce full RSML geometry. -->
      </root>
    </plant>
  </scene>
</rsml>
`;
  }

  roCrate(fileNames) {
    return JSON.stringify({
      '@context': 'https://w3id.org/ro/crate/1.1/context',
      '@graph': [
        { '@id': 'ro-crate-metadata.json', '@type': 'CreativeWork',
          conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' }, about: { '@id': './' } },
        { '@id': './', '@type': 'Dataset',
          name: `${this.preset.title} — ${this.image?.filename || 'image'}`,
          description: this.preset.description,
          datePublished: this.createdAt,
          license: { '@id': 'https://creativecommons.org/licenses/by/4.0/' },
          identifier: this.bundleId,
          hasPart: fileNames.map(f => ({ '@id': f })) },
        { '@id': 'https://creativecommons.org/licenses/by/4.0/',
          '@type': 'CreativeWork', name: 'CC BY 4.0' },
      ],
    }, null, 2);
  }

  readme() {
    const s = this.scale || {};
    const uncal = (s.source === 'none' || !s.pxPerMm);
    return `# ${this.preset.title}

${this.preset.description}

## Method

${this.preset.method}

## Calibration

${uncal
  ? '**This analysis is UNCALIBRATED.** No scale was supplied, so every length in\n`measurements.csv` is in **pixels** and every area in **pixels squared**. Do not\nreport these as physical units.'
  : `Scale: **${s.pxPerMm} px/${s.unit}**, from \`${s.source}\`.\nLengths are in ${s.unit}, areas in ${s.unit}².`}

## Variables

| Column | Unit | Description |
|---|---|---|
${(this.preset.outputs || []).map(o => `| ${o.name} | ${o.unit} | ${o.description} |`).join('\n')}

## Reproducing this

1. Open <https://dr-richard-barker.github.io/cose-fiji/>
2. Load the image recorded in \`provenance.json\` → \`image.url\`
3. Set the scale to \`provenance.json\` → \`scale.pixelsPerMm\`
4. Run \`analysis.ijm\` (Plugins ▸ Macros ▸ Run…)

\`provenance.json\` carries SHA-256 for both the source image and the macro, so
you can confirm you are re-running the same analysis on the same bytes.

## Licence

Data: CC-BY-4.0 (see LICENSE). Produced with ImageJ (public domain) via
ImageJ.JS/CheerpJ; SmartRoot is GPL-3.0.
`;
  }

  license() {
    return `Creative Commons Attribution 4.0 International (CC BY 4.0)

You are free to share and adapt this material for any purpose, even
commercially, provided you give appropriate credit, link to the licence, and
indicate if changes were made.

Full text: https://creativecommons.org/licenses/by/4.0/legalcode
`;
  }

  /** Assemble every file and return the .zip blob. */
  async build() {
    this.macroSha = this.macro ? await sha256Hex(this.macro) : null;

    const files = {
      'measurements.csv': this.csv(),
      'dataset.json': this.miappe(),
      'provenance.json': this.provenance(),
      'README.md': this.readme(),
      'LICENSE': this.license(),
    };
    if (this.macro) files['analysis.ijm'] = this.macro;
    if (this.log) files['imagej-log.txt'] = this.log;
    if (this.preset.name === 'roots') files['roots.rsml'] = this.rsml();

    files['ro-crate-metadata.json'] = this.roCrate(Object.keys(files));
    return makeZip(files);
  }

  /** Build and hand the .zip to the browser as a download. */
  async download() {
    const blob = await this.build();
    const stem = (this.image?.filename || 'analysis').replace(/\.[^.]+$/, '');
    const name = `${stem}__${this.preset.name}__${this.createdAt.slice(0, 10)}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return name;
  }
}
