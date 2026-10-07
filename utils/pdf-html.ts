/** Shared HTML helpers and stylesheet for the Evidence Package PDF (no React Native imports). */

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function infoRow(label: string, value: string) {
  return `
    <div class="info-row">
      <div class="info-label">${escapeHtml(label)}</div>
      <div class="info-value">${escapeHtml(value || '—')}</div>
    </div>`;
}

/** Stylesheet for the whole Evidence Package. */
export const REPORT_CSS = `
    @page { margin: 36px 32px; }
    body {
      font-family: "Times New Roman", Times, Georgia, serif;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      font-size: 12.5px;
      line-height: 1.45;
    }
    .page { padding: 8px 4px 24px; }
    h1 {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 22px;
      margin: 0 0 18px;
      color: #111;
      border-bottom: 2px solid #222;
      padding-bottom: 8px;
    }
    h2 {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 15px;
      margin: 0 0 10px;
      color: #111;
    }
    h3 {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 12.5px;
      margin: 14px 0 6px;
      color: #222;
    }
    .narrative { margin: 0 0 10px; text-align: justify; }
    .bullets { margin: 6px 0 12px 18px; padding: 0; }
    .bullets li { margin: 0 0 5px; }
    .block { margin: 0 0 18px; }
    .section { margin: 0 0 18px; }
    .page-break { page-break-before: always; }
    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 5px 0;
      border-bottom: 1px solid #ddd;
      font-family: Helvetica, Arial, sans-serif;
      font-size: 12px;
    }
    .info-label { color: #444; min-width: 38%; }
    .info-value { font-weight: 700; text-align: right; max-width: 60%; }
    .cover {
      display: block;
      width: auto;
      max-width: 48%;
      max-height: 280px;
      height: auto;
      object-fit: contain;
      object-position: left top;
      margin: 0 0 16px 0;
      border: 1px solid #ccc;
      background: #f3f3f3;
    }
    .section-banner {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 6px;
      padding-bottom: 6px;
      border-bottom: 2px solid #222;
    }
    .section-count {
      font-family: Helvetica, Arial, sans-serif;
      color: #666;
      font-size: 11px;
      margin: 0 0 12px;
    }
    .map-row {
      display: flex;
      justify-content: flex-start;
      gap: 18px;
      margin: 8px 0 4px;
      page-break-inside: avoid;
    }
    .map-cell {
      position: relative;
      width: 42%;
      max-width: 42%;
    }
    .map-cell-second {
      margin-left: 34px;
    }
    .map-shot {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #f3f3f3;
      object-fit: cover;
    }
    .map-pin {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 16px;
      height: 16px;
      margin-left: -8px;
      margin-top: -20px;
      background: #e74c3c;
      border: 2px solid #fff;
      border-radius: 50% 50% 50% 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.35);
      transform: rotate(-45deg);
    }
    .photo-block {
      margin: 0 0 14px;
      page-break-inside: avoid;
      text-align: left;
    }
    .photo-block + .photo-block {
      margin-top: 70px;
    }
    .photo-block img,
    .photo-block-annotated img,
    .photo-block img.annotated {
      display: block;
      box-sizing: border-box;
      width: 82%;
      max-width: 82%;
      height: 340px;
      max-height: 340px;
      object-fit: contain;
      object-position: center center;
      border: 1px solid #ccc;
      background: #f3f3f3;
      margin: 0;
    }
    .caption {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10.5px;
      color: #444;
      margin-top: 5px;
      text-align: left;
    }
    .note {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10px;
      color: #555;
      margin: 6px 0 10px;
      text-align: justify;
    }
    .evidence-banner {
      border-left: 5px solid #888;
      background: #f4f4f4;
      padding: 10px 12px;
      margin: 0 0 12px;
      page-break-inside: avoid;
    }
    .evidence-banner.level-observed { border-color: #1e7b45; background: #eef7f1; }
    .evidence-banner.level-radar_estimated { border-color: #c47a12; background: #fdf5e8; }
    .evidence-banner.level-model_indicated,
    .evidence-banner.level-none,
    .evidence-banner.level-unavailable { border-color: #8a8a8a; background: #f4f4f4; }
    .evidence-level {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }
    .evidence-headline { font-size: 12.5px; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10px;
      margin: 4px 0 6px;
      page-break-inside: auto;
    }
    .data-table th {
      text-align: left;
      background: #222;
      color: #fff;
      padding: 4px 5px;
      font-weight: 700;
    }
    .data-table td {
      padding: 4px 5px;
      border-bottom: 1px solid #ddd;
      vertical-align: top;
    }
    .data-table tr { page-break-inside: avoid; }
    .count-row {
      display: flex;
      gap: 10px;
      margin: 8px 0 10px;
      page-break-inside: avoid;
    }
    .count-box {
      flex: 1;
      border: 1px solid #ccc;
      padding: 8px;
      text-align: center;
      font-family: Helvetica, Arial, sans-serif;
    }
    .count-num { font-size: 22px; font-weight: 700; }
    .count-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.4px; }
    .swath-map {
      position: relative;
      width: 100%;
      height: 0;
      overflow: hidden;
      border: 1px solid #bbb;
      margin: 6px 0 6px;
      page-break-inside: avoid;
    }
    .swath-layer, .swath-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .swath-blank { background: #eef2f3; }
    .legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10px;
      color: #333;
      margin: 0 0 4px;
      page-break-inside: avoid;
    }
    .legend-title { font-weight: 700; }
    .legend-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .legend-swatch { display: inline-block; width: 14px; height: 10px; border: 1px solid rgba(0,0,0,0.25); }
    .legend-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
    .legend-tri {
      display: inline-block;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 9px solid;
    }
    .legend-ring { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #E01E2D; }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10px;
      color: #666;
      text-align: center;
    }
  `;
