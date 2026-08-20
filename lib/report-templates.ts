/** Default Evidence Package narrative language (ClaimCapture Field Capture Flow v4). */

export function damageDefinitionsHtml() {
  return `
    <h3>Purpose</h3>
    <p class="narrative">
      This report documents objective evidence gathered to support claim evaluation regarding physical loss
      caused by wind, hail, or debris. It does not make final coverage determinations.
    </p>
    <h3>Investigation process</h3>
    <p class="narrative">
      Visual inspection of slopes and elevations; collateral damage documentation; weather / third-party data
      review; property-owner interview when available; material and repairability assessment; documentation of
      pre-existing conditions and applicable code considerations.
    </p>
    <h3>Physical damage</h3>
    <p class="narrative">
      Physical damage is a distinct and demonstrable physical alteration of a building component.
      Functional damage determination is guided by HAAG Engineering standards and related industry practice.
    </p>
    <h3>Asphalt shingles</h3>
    <p class="narrative">
      Indicators may include granule loss, bruising, punctures (hail), or torn / lifted shingles (wind).
      Damage is treated as functional when it compromises waterproofing performance or remaining service life.
    </p>
    <h3>Metal / copper / aluminum</h3>
    <p class="narrative">
      Indicators include dents, creases, and impact marks. Spot repairs on finished metal systems are often
      impractical; replacement of the affected assembly may be required for a uniform weather-tight result.
    </p>
    <h3>Functional vs cosmetic</h3>
    <p class="narrative">
      <strong>Functional damage</strong> compromises serviceability, structural integrity, or waterproofing.
      <strong>Cosmetic damage</strong> affects appearance or perceived value without impairing material function.
    </p>
  `;
}

export function existingConditionsHtml(roofAge: string) {
  return `
    <p class="narrative">
      The estimated roof age is <strong>${roofAge}</strong>. Age-related wear and other pre-existing conditions
      may increase vulnerability to storm forces, but are not identified in this package as the cause of the
      storm-related damage that was observed and photographed during this inspection.
    </p>
  `;
}

export function codesAndStandardsHtml() {
  return `
    <p class="narrative">
      All work shall meet applicable requirements of the <strong>2019 Residential Code of Georgia — Chapter 9</strong>
      (including R903–R905), manufacturer installation instructions (e.g., Owens Corning, GAF), and local code
      enforcement / permitting requirements. Regional Citations are admin-editable company defaults; Georgia is
      the current default template language.
    </p>
  `;
}

export function inspectorDeclarationHtml(inspector: string) {
  return `
    <p class="narrative">
      I declare that the findings in this Evidence Package are based on physical evidence observed during the
      inspection of the subject property. The undersigned inspector is <strong>HAAG Certified</strong>.
      This report supports claim evaluation and does not constitute a coverage decision.
    </p>
    <p class="narrative"><strong>Inspector:</strong> ${inspector}</p>
  `;
}

export function summaryOfFindingsHtml() {
  return `
    <p class="narrative">
      Summary of Findings documents objective evidence gathered after wind or hail events to demonstrate
      conditions observed at the time of inspection. Photo sections below are organized by capture category and
      damage tags applied in the field.
    </p>
  `;
}
