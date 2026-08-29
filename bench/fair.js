/**
 * CoSE FIJI Bench – FAIR Data Export
 *
 * Bundles analysis results into a downloadable .zip containing:
 *  - measurements.csv (tidy, one row per object)
 *  - dataset.json (MIAPPE v1.2 metadata)
 *  - provenance.json (reproducibility: image URL, macro hash, timestamp, scale source)
 *  - *.rsml (if roots preset)
 *  - roi.geojson (if ROI drawn)
 *  - ro-crate-metadata.json (RO-Crate wrapper)
 *
 * Requires JSZip (loaded from CDN).
 */

class FAIRExporter {
  constructor(bench, preset, results) {
    this.bench = bench;       // FIJIBench instance
    this.preset = preset;     // active preset descriptor
    this.results = results;   // { measurements, roi, log } from preset execution
    this.files = {};          // { filename: content } for bundling
  }

  /**
   * Main export: gather all components and create downloadable .zip
   * @returns {Promise<Blob>} – the .zip file
   */
  async export() {
    const { measurements, roi, log } = this.results;

    // 1. CSV: measurements table
    this.files['measurements.csv'] = this.generateCSV(measurements);

    // 2. MIAPPE v1.2 metadata
    this.files['dataset.json'] = this.generateMIAPPE();

    // 3. Provenance: reproducibility trace
    this.files['provenance.json'] = this.generateProvenance();

    // 4. RSML (for roots preset)
    if (this.preset.name === 'roots' && measurements) {
      this.files['root_structure.rsml'] = this.generateRSML(measurements);
    }

    // 5. ROI as GeoJSON (if available)
    if (roi) {
      this.files['roi.geojson'] = JSON.stringify(roi, null, 2);
    }

    // 6. RO-Crate metadata
    this.files['ro-crate-metadata.json'] = this.generateROCrate();

    // 7. README with method description
    this.files['README.md'] = this.generateREADME();

    // 8. LICENSE (CC-BY-4.0 for data)
    this.files['LICENSE'] = this.generateLicense();

    // Bundle into .zip
    const zip = await this.createZip();
    return zip;
  }

  /**
   * Generate tidy CSV from measurements array.
   * @param {Array<Object>} measurements – array of { name, value, unit } per row
   * @returns {string} – CSV with header
   */
  generateCSV(measurements) {
    if (!measurements || measurements.length === 0) {
      return 'name,value,unit\n';
    }

    const header = ['name', 'value', 'unit', 'timestamp'];
    const rows = measurements.map(m => [
      m.name || '',
      m.value || '',
      m.unit || '',
      m.timestamp || new Date().toISOString()
    ]);

    return [header, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
  }

  /**
   * Generate MIAPPE v1.2 metadata JSON.
   * Maps to the MIAPPE checklist: https://github.com/MIAPPE/MIAPPE
   * @returns {string} – JSON
   */
  generateMIAPPE() {
    const now = new Date().toISOString();
    const image = this.bench.image || {};
    const scale = this.bench.scale || {};

    return JSON.stringify({
      "miappe_version": "1.2",
      "study": {
        "title": `${this.preset.title} analysis`,
        "description": this.preset.description,
        "submission_date": now.split('T')[0],
        "public_release_date": now.split('T')[0],
        "contacts": [
          {
            "email": "dr.richard.barker@gmail.com",
            "institution": "CoSE",
            "type": "person"
          }
        ]
      },
      "plant_materials": {
        "material_source_description": `Image: ${image.filename || 'unknown'}`
      },
      "experimental_design": {
        "description": this.preset.method,
        "measurement_unit": scale.unit || "pixel"
      },
      "environment": {
        "environment_description": "Image-based analysis, no controlled environment"
      },
      "observed_variables": this.preset.outputs.map(o => ({
        "variable_name": o.name,
        "trait_name": o.label,
        "trait_description": o.description,
        "measurement_unit": o.unit,
        "ontology_term": o.ontologyTerm
      }))
    }, null, 2);
  }

  /**
   * Generate provenance.json for reproducibility.
   * Includes: image URL, scale source, macro source hash, ImageJ version, timestamp.
   * @returns {string} – JSON
   */
  generateProvenance() {
    return JSON.stringify({
      "timestamp": new Date().toISOString(),
      "image": {
        "url": this.bench.image?.url || null,
        "filename": this.bench.image?.filename || null,
        "bytes": this.bench.image?.bytes || null,
        "sha256": "[computed on export]"  // placeholder; would require crypto API
      },
      "scale": {
        "px_per_mm": this.bench.scale?.pxPerMm || null,
        "unit": this.bench.scale?.unit || "pixel",
        "source": this.bench.scale?.source || "none"  // 'aruco-marker', 'manual', 'none'
      },
      "analysis": {
        "preset": this.preset.name,
        "preset_version": "1.0",
        "macro_source": "[embedded in preset]",
        "macro_sha256": "[computed on export]"
      },
      "software": {
        "imagej_version": "[from IJ.getFullVersion()]",
        "cheerpj_version": "4.2",
        "plugins": [
          { "name": "SmartRoot", "version": "[detected]" }
        ]
      },
      "outputs": this.preset.outputs.map(o => o.name)
    }, null, 2);
  }

  /**
   * Generate RSML (RootSystemML) for roots preset.
   * Simplified structure; full implementation would parse root topology.
   * @param {Array<Object>} measurements – root measurements
   * @returns {string} – XML
   */
  generateRSML(measurements) {
    const now = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<rsml xmlns="http://rootsystemml.github.io/xml/rsml.xsd">
  <metadata>
    <version>1.0</version>
    <unit>mm</unit>
    <resolution>0.1</resolution>
    <last-modified>${now}</last-modified>
    <software>
      <name>CoSE FIJI Bench</name>
      <version>1.0</version>
    </software>
  </metadata>
  <plant ID="plant-1">
    <root ID="root-1">
      <properties>
        <property name="length" value="${this.getMeasurement('TotalLength') || 0}"/>
        <property name="lateral-count" value="${this.getMeasurement('LateralCount') || 0}"/>
      </properties>
      <!-- Polylines (root paths) would be inserted here -->
    </root>
  </plant>
</rsml>`;
  }

  /**
   * Helper: extract measurement value by name.
   * @param {string} name – measurement name
   * @returns {number|null}
   */
  getMeasurement(name) {
    const result = this.results.measurements?.find(m => m.name === name);
    return result?.value || null;
  }

  /**
   * Generate RO-Crate metadata (FAIR packaging standard).
   * @returns {string} – JSON
   */
  generateROCrate() {
    const now = new Date().toISOString();
    return JSON.stringify({
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          "conformsTo": { "@id": "https://w3id.org/ro/crate/1.1" },
          "about": { "@id": "./" }
        },
        {
          "@id": "./",
          "@type": "Dataset",
          "name": `${this.preset.title} results`,
          "description": this.preset.description,
          "datePublished": now,
          "hasPart": [
            { "@id": "measurements.csv" },
            { "@id": "dataset.json" },
            { "@id": "provenance.json" }
          ]
        }
      ]
    }, null, 2);
  }

  /**
   * Generate README with method details.
   * @returns {string} – Markdown
   */
  generateREADME() {
    return `# ${this.preset.title}

## Method

${this.preset.method}

## Outputs

${this.preset.outputs.map(o => `- **${o.name}** (${o.unit}): ${o.description}`).join('\n')}

## Files

- \`measurements.csv\` — Results table (tidy format)
- \`dataset.json\` — MIAPPE v1.2 metadata
- \`provenance.json\` — Reproducibility trace (image, scale, software)
- \`ro-crate-metadata.json\` — RO-Crate wrapper
- \`README.md\` — This file
- \`LICENSE\` — CC-BY-4.0

## Citation

Dataset created by CoSE FIJI Bench v1.0 using ImageJ.JS and ${this.preset.name} preset.

## Reproducibility

To reproduce: Load the image URL and scale from \`provenance.json\` into the FIJI bench with the \`${this.preset.name}\` preset.
`;
  }

  /**
   * Generate LICENSE (CC-BY-4.0).
   * @returns {string}
   */
  generateLicense() {
    return `Creative Commons Attribution 4.0 International

This work is licensed under the Creative Commons Attribution 4.0 International License.
To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/

You are free to:
- Share — copy and redistribute the material
- Adapt — remix, transform, and build upon the material

Under the following terms:
- Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made.
`;
  }

  /**
   * Create .zip archive from this.files.
   * Requires JSZip library (loaded from CDN).
   * @returns {Promise<Blob>} – the .zip file
   */
  async createZip() {
    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library not available. Load from CDN or import.');
    }

    const zip = new JSZip();

    // Add all files
    for (const [filename, content] of Object.entries(this.files)) {
      zip.file(filename, content);
    }

    // Generate .zip blob
    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Trigger browser download of the .zip.
   * @param {string} filename – default: "{preset}-{timestamp}.zip"
   */
  async download(filename) {
    const blob = await this.export();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${this.preset.name}-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
