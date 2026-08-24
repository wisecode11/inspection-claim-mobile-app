/** Evidence Package narrative language — aligned to ClaimCapture Field Capture Flow v4
 *  and the Louis Wang “Property Damage Assessment Summary” sample. */

export function summaryOfFindingsHtml() {
  return `
    <p class="narrative">
      This report documents objective evidence gathered during the inspection of the subject property
      following a reported wind and/or hail event. The purpose of this report is to present findings that
      demonstrate a sudden and accidental physical loss to the property, consistent with damage from wind,
      hail, or wind-driven debris. This report does not make coverage determinations; it is intended to
      support further claim evaluation by the carrier and/or policyholder.
    </p>
  `;
}

export function investigationProcessHtml() {
  return `
    <p class="narrative">The following methodologies were used during the investigation:</p>
    <ul class="bullets">
      <li>Visual inspection of all slopes and elevations of the roof and structure.</li>
      <li>Collection of collateral damage evidence across the property.</li>
      <li>Analysis of weather data and third-party reports.</li>
      <li>Interview / testimony of the property owner (when available).</li>
      <li>Review of building materials and assessment of repairability.</li>
      <li>Documentation of pre-existing conditions, directional damage patterns, and code compliance factors.</li>
    </ul>
  `;
}

export function damageDefinitionsHtml() {
  return `
    <p class="narrative">
      For the purposes of this assessment, <strong>physical damage</strong> is defined as a distinct and
      demonstrable physical alteration to the property. This definition aligns with standards commonly
      accepted by U.S. courts in the absence of specific language within the insurance policy. If a different
      definition or threshold is stated in the policy, conclusions may be revised accordingly.
    </p>
    <p class="narrative">
      Damage may be <strong>functional</strong> (affecting performance or service life) or
      <strong>cosmetic</strong> (affecting appearance without impairing function). Unless expressly excluded
      by policy, either may qualify as physical damage.
    </p>

    <h3>General Damage Criteria</h3>
    <p class="narrative">Physical damage includes, but is not limited to:</p>
    <ul class="bullets">
      <li>Granule loss, bruising, punctures, or fractures on shingles due to hail impact</li>
      <li>Torn, creased, or lifted shingles from wind uplift</li>
      <li>Displacement, denting, or deformation of exterior components such as gutters, siding, or fascia</li>
      <li>Spatter marks, burnishing, or surface indentations from wind-driven debris</li>
      <li>Any observable impact that alters the shape, surface, or finish of building materials</li>
    </ul>

    <h3>Hail Damage — Asphalt Shingles</h3>
    <p class="narrative">
      Defined as physical alteration caused by hailstone impact, resulting in granule loss, mat exposure,
      bruising, cracks, or punctures. Per HAAG Engineering standards, damage is considered functional if it
      compromises the waterproofing ability or expected service life of the roofing system.
    </p>

    <h3>Hail Damage — Metal / Copper / Aluminum Siding / Roofing</h3>
    <p class="narrative">
      Typically presents as dents, creases, or surface indentations resulting from hail impact. Finish loss
      or exposed metal may also occur. The nature of metal / copper / aluminum makes spot repairs impractical
      without further damage to adjacent panels.
    </p>

    <h3>Functional vs. Cosmetic Damage</h3>
    <ul class="bullets">
      <li><strong>Functional Damage:</strong> Any alteration that compromises the long-term serviceability,
        structural integrity, or waterproofing capability of the material or system — even if it does not
        result in immediate leakage.</li>
      <li><strong>Cosmetic Damage:</strong> Aesthetic impact that does not affect the material’s function
        but may impact appearance, uniformity, and property value.</li>
    </ul>
  `;
}

export function photographicEvidenceIntroHtml() {
  return `
    <p class="narrative">
      This section provides visual and written documentation gathered during the investigation to support
      the presence, type, and extent of observed exterior damages. Photographs captured during the inspection
      illustrate physical alterations consistent with storm-related activity. Both detailed and overview
      images are included to establish context, verify location, and support the objective findings outlined
      in this report. This documentation serves as a visual record of the conditions present at the time of
      inspection and helps substantiate conclusions regarding the cause and severity of damage.
    </p>
  `;
}

export function existingConditionsHtml(roofAge: string) {
  const ageLabel = roofAge.trim() || 'unknown age';
  return `
    <p class="narrative">
      The roofing system is estimated to be approximately <strong>${ageLabel}</strong> and reflects typical
      age-related characteristics observed in similar systems. Pre-existing conditions include the way the
      roof was originally assembled — such as type of decking, underlayment, shingle material, fasteners,
      and flashing — along with wear patterns accumulated over time.
    </p>
    <p class="narrative">Notable conditions may include:</p>
    <ul class="bullets">
      <li>General granule loss</li>
      <li>Age-related weathering consistent with the estimated roof age</li>
    </ul>
    <p class="narrative">
      These elements are considered part of the existing condition of the roof at the time of the inspection.
      While they may contribute to a roof’s vulnerability during a storm, they are not the cause of the
      damage observed. The physical damage documented is consistent with a new, sudden, and accidental event
      and not with gradual deterioration or installation-related deficiencies.
    </p>
  `;
}

export function codesAndStandardsHtml() {
  return `
    <p class="narrative">
      All repairs and restoration work outlined in this report must meet the minimum requirements set forth
      by applicable building codes, manufacturer installation instructions, and local jurisdictional standards.
      The following references provide the governing framework for evaluating and performing compliant
      roofing repairs:
    </p>

    <h3>2019 Residential Code of Georgia — Chapter 9: Roof Assemblies</h3>
    <p class="narrative">
      Applicable provisions from Chapter 9 establish minimum standards for roof coverings, materials,
      installation methods, weather protection, and performance requirements. Key sections referenced in
      this assessment include:
    </p>
    <ul class="bullets">
      <li><strong>R903.1 — Weather Protection:</strong> Roof assemblies must be designed and installed to
        protect the structure from moisture intrusion using approved coverings and methods.</li>
      <li><strong>R904.1 — Scope of Material Standards:</strong> Roofing materials must be installed in
        accordance with the code and the manufacturer’s instructions.</li>
      <li><strong>R904.2 — Material Compatibility:</strong> All materials used must be compatible with one
        another and with the structure.</li>
      <li><strong>R905.1 — Application Requirements:</strong> Roof coverings must be applied per the
        manufacturer’s installation instructions and applicable code provisions.</li>
      <li><strong>R905.2 — Asphalt Shingles:</strong> Provides installation requirements for fasteners,
        slope limitations, underlayment, ice barriers, flashing, and attachment methods specific to asphalt
        shingle systems.</li>
    </ul>

    <h3>Manufacturer Installation Instructions</h3>
    <p class="narrative">
      All roofing products must be installed according to the technical guidelines published by the product
      manufacturer (e.g., Owens Corning, GAF, CertainTeed). These include required fastener counts, approved
      underlayment types, ventilation allowances, and flashing specifications. Where manufacturer guidance
      is more restrictive than code, the more stringent standard shall apply per RCO Section R102.1.
    </p>

    <h3>Local Code Enforcement &amp; Permitting Requirements</h3>
    <p class="narrative">
      All repairs must adhere to local building department policies, including permitting, inspections, and
      final approval. Jurisdictional enforcement may interpret or supplement the Residential Code of Georgia
      with additional administrative rules, which are to be followed as part of the scope of work.
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
