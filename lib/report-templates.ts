/** Evidence Package narrative — admin Report language when available, else built-in defaults. */

export type ReportLanguageCitation = {
  id: string;
  state: string;
  code: string;
  title: string;
  body: string;
  source?: string;
};

export type ReportLanguagePackage = {
  templateId?: string;
  templateName?: string;
  summaryOfFindings?: string;
  investigationProcess?: string;
  damageDefinitions?: string;
  existingConditions?: string;
  legalFooter?: string;
  citations?: ReportLanguageCitation[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Convert admin plain-text body into PDF-safe HTML paragraphs. */
export function plainTextToNarrativeHtml(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';

  const blocks = trimmed.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) return '';

      const bulletLines = lines.filter((line) => /^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line));
      if (bulletLines.length === lines.length && lines.length > 1) {
        const items = lines
          .map((line) => line.replace(/^[-•*]\s+/, '').replace(/^\d+[.)]\s+/, ''))
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('');
        return `<ul class="bullets">${items}</ul>`;
      }

      return `<p class="narrative">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('');
}

function withRoofAge(template: string, roofAge: string) {
  const ageLabel = roofAge.trim() || 'unknown age';
  return template.replaceAll('[ROOF AGE]', ageLabel).replaceAll('[ROOF_AGE]', ageLabel);
}

function defaultSummaryOfFindingsHtml() {
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

function defaultInvestigationProcessHtml() {
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

function defaultDamageDefinitionsHtml() {
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
  `;
}

function defaultExistingConditionsHtml(roofAge: string) {
  const ageLabel = roofAge.trim() || 'unknown age';
  return `
    <p class="narrative">
      The roofing system is estimated to be approximately <strong>${escapeHtml(ageLabel)}</strong> and reflects typical
      age-related characteristics observed in similar systems. Pre-existing conditions include the way the
      roof was originally assembled — such as type of decking, underlayment, shingle material, fasteners,
      and flashing — along with wear patterns accumulated over time.
    </p>
    <p class="narrative">
      These elements are considered part of the existing condition of the roof at the time of the inspection.
      While they may contribute to a roof’s vulnerability during a storm, they are not the cause of the
      damage observed.
    </p>
  `;
}

function defaultCodesAndStandardsHtml() {
  return `
    <p class="narrative">
      All repairs and restoration work outlined in this report must meet the minimum requirements set forth
      by applicable building codes, manufacturer installation instructions, and local jurisdictional standards.
    </p>
  `;
}

export function summaryOfFindingsHtml(language?: ReportLanguagePackage | null) {
  const fromAdmin = plainTextToNarrativeHtml(language?.summaryOfFindings || '');
  return fromAdmin || defaultSummaryOfFindingsHtml();
}

export function investigationProcessHtml(language?: ReportLanguagePackage | null) {
  const fromAdmin = plainTextToNarrativeHtml(language?.investigationProcess || '');
  return fromAdmin || defaultInvestigationProcessHtml();
}

export function damageDefinitionsHtml(language?: ReportLanguagePackage | null) {
  const fromAdmin = plainTextToNarrativeHtml(language?.damageDefinitions || '');
  return fromAdmin || defaultDamageDefinitionsHtml();
}

export function photographicEvidenceIntroHtml() {
  return `
    <p class="narrative">
      This section provides visual and written documentation gathered during the investigation to support
      the presence, type, and extent of observed exterior damages. Photographs captured during the inspection
      illustrate physical alterations consistent with storm-related activity. Both detailed and overview
      images are included to establish context, verify location, and support the objective findings outlined
      in this report.
    </p>
  `;
}

export function existingConditionsHtml(
  roofAge: string,
  language?: ReportLanguagePackage | null
) {
  const raw = language?.existingConditions?.trim();
  if (raw) {
    return plainTextToNarrativeHtml(withRoofAge(raw, roofAge));
  }
  return defaultExistingConditionsHtml(roofAge);
}

export function codesAndStandardsHtml(language?: ReportLanguagePackage | null) {
  const citations = language?.citations || [];
  if (citations.length === 0) {
    return defaultCodesAndStandardsHtml();
  }

  const blocks = citations
    .map((citation) => {
      const heading = [citation.state, citation.code].filter(Boolean).join(' ');
      const title = citation.title ? `${heading ? `${heading} — ` : ''}${citation.title}` : heading;
      const body = plainTextToNarrativeHtml(citation.body);
      const source = citation.source?.trim()
        ? `<p class="narrative"><em>Source: ${escapeHtml(citation.source)}</em></p>`
        : '';
      return `
        <h3>${escapeHtml(title || 'Code citation')}</h3>
        ${body || '<p class="narrative">—</p>'}
        ${source}
      `;
    })
    .join('');

  return `
    <p class="narrative">
      All repairs and restoration work outlined in this report must meet the minimum requirements set forth
      by applicable building codes, manufacturer installation instructions, and local jurisdictional standards.
      The following citations were selected by the company for this evidence package:
    </p>
    ${blocks}
  `;
}

export function disclaimerHtml(language?: ReportLanguagePackage | null) {
  const fromAdmin = plainTextToNarrativeHtml(language?.legalFooter || '');
  if (!fromAdmin) return '';
  return `
    <div class="section page-break">
      <h2>Disclaimer</h2>
      ${fromAdmin}
    </div>
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
