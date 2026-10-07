/**
 * "Verified Weather Data" + "Weather History" pages built from NOAA weather evidence.
 * Pure string rendering (no React Native imports) so it can be previewed outside the app.
 */
import type {
  EvidenceKind,
  EvidenceLevel,
  GeoBounds,
  SwathBaseMap,
  WeatherEvidence,
  WeatherEvidenceItem,
} from '@/lib/api';
import { escapeHtml, infoRow } from '@/utils/pdf-html';

const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  observed: 'Observed storm reports near the property',
  radar_estimated: 'Radar-estimated hail near the property',
  model_indicated: 'Not verified — weather model indication only',
  none: 'No supporting storm reports found',
  unavailable: 'Weather evidence incomplete — sources unavailable',
};

const KIND_LABEL: Record<EvidenceKind, string> = {
  observed: 'Observed',
  radar_estimated: 'Radar-estimated',
  official_record: 'Official record',
  model_indicated: 'Model-indicated',
};

function formatUtc(iso: string | null | undefined, withTime = true) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (!withTime) return day;
  const time = date.toISOString().slice(11, 16);
  return `${day} ${time} UTC`;
}

function formatDuration(minutes: number | null | undefined) {
  // Point events (begin = end, typical for hail) have no meaningful duration.
  if (minutes == null || minutes < 1) return '—';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function distanceText(item: WeatherEvidenceItem) {
  return `${item.distanceMiles.toFixed(1)} mi ${item.direction}`;
}

function typeLabel(item: WeatherEvidenceItem) {
  if (item.eventType) return item.eventType;
  return item.type === 'hail' ? 'Hail' : item.type === 'wind' ? 'Wind' : 'Tornado';
}

/** Deterministic, human-readable ID for the weather page (date of loss + coordinates). */
function weatherReportId(evidence: WeatherEvidence) {
  const { latitude, longitude, dateOfLoss } = evidence.query;
  const lat = `${Math.abs(latitude).toFixed(3).replace('.', '')}${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(3).replace('.', '')}${longitude >= 0 ? 'E' : 'W'}`;
  return `WX-${dateOfLoss.slice(0, 10).replace(/-/g, '')}-${lat}${lon}`;
}

function table(headers: string[], rows: string[][]) {
  return `
    <table class="data-table">
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

function renderObservedReports(evidence: WeatherEvidence) {
  const reports = evidence.observedReports.slice(0, 10);
  if (reports.length === 0) {
    return `<p class="narrative">No hail, damaging-wind or tornado reports from the National Weather Service were found within
      ${evidence.query.eventRadiusMiles} miles of the property during the search window.</p>`;
  }
  return table(
    ['Date / time', 'Type', 'Size / speed', 'Distance', 'Reported by', 'Location'],
    reports.map((r) => [
      formatUtc(r.occurredAt),
      typeLabel(r),
      r.magnitudeLabel,
      distanceText(r),
      [r.reporter || 'NWS report', r.measured === true ? 'measured' : r.measured === false ? 'estimated' : '']
        .filter(Boolean)
        .join(', '),
      r.location || '—',
    ])
  );
}

function renderRadarDetections(evidence: WeatherEvidence) {
  const detections = [...evidence.radarDetections]
    .sort((a, b) => (b.hailSizeIn ?? 0) - (a.hailSizeIn ?? 0) || a.distanceMiles - b.distanceMiles)
    .slice(0, 8);
  if (detections.length === 0) {
    return `<p class="narrative">No NEXRAD hail signatures were detected within ${evidence.query.eventRadiusMiles} miles
      of the property during the search window.</p>`;
  }
  return `
    ${table(
      ['Date / time', 'Est. max hail size', 'Probability (severe)', 'Distance', 'Radar'],
      detections.map((d) => [
        formatUtc(d.occurredAt),
        d.hailSizeIn != null ? `${d.hailSizeIn.toFixed(2)}"` : '—',
        `${d.probability ?? '—'}% (${d.severeProbability ?? '—'}%)`,
        distanceText(d),
        d.radar || '—',
      ])
    )}
    <p class="note">Radar values are NEXRAD hail-algorithm estimates for storm cells passing near the property,
      not ground measurements. Largest ${detections.length} of ${evidence.radarDetections.length} signatures shown.</p>`;
}

function renderHistory(evidence: WeatherEvidence) {
  const history = evidence.history;
  if (!history || !history.coverageThrough) {
    return `<p class="narrative">Official storm history (NOAA NCEI Storm Events Database) was not available for this report.</p>`;
  }
  const { counts } = history;
  const events = history.events.slice(0, 15);
  return `
    <p class="narrative">
      NOAA NCEI Storm Events records within <strong>${history.radiusMiles} miles</strong> of the property for the
      <strong>${history.years} years</strong> up to and including the date-of-loss window
      (${formatUtc(history.since, false)} – ${formatUtc(history.until, false)}). Official records are published with a
      delay; data is available through <strong>${formatUtc(history.coverageThrough, false)}</strong>.
    </p>
    <div class="count-row">
      <div class="count-box"><div class="count-num">${counts.hailDays}</div><div class="count-label">Hail days</div></div>
      <div class="count-box"><div class="count-num">${counts.windDays}</div><div class="count-label">Wind days</div></div>
      <div class="count-box"><div class="count-num">${counts.tornadoDays}</div><div class="count-label">Tornado days</div></div>
    </div>
    ${
      events.length
        ? table(
            ['Date', 'Event type', 'Magnitude', 'Duration', 'Distance'],
            events.map((e) => [
              formatUtc(e.occurredAt, false),
              typeLabel(e),
              e.magnitudeLabel,
              formatDuration(e.durationMinutes),
              distanceText(e),
            ])
          )
        : '<p class="narrative">No official hail, thunderstorm-wind or tornado events were recorded in this area for the period.</p>'
    }
    ${history.totalEvents > events.length ? `<p class="note">Most recent ${events.length} of ${history.totalEvents} recorded events shown.</p>` : ''}`;
}

function renderSources(evidence: WeatherEvidence) {
  const items = evidence.sources
    .map((source) => {
      const status =
        source.status === 'ok'
          ? 'retrieved'
          : source.status === 'not_ingested'
            ? 'not available'
            : `unavailable${source.error ? ` (${source.error})` : ''}`;
      const coverage = source.coverageThrough ? `; records through ${formatUtc(source.coverageThrough, false)}` : '';
      return `<li><strong>${escapeHtml(source.name)}</strong> — ${escapeHtml(KIND_LABEL[source.evidence])}; ${escapeHtml(
        status
      )}${escapeHtml(coverage)}</li>`;
    })
    .join('');
  return `
    <ul class="bullets">${items}</ul>
    <p class="note">
      <strong>Observed</strong>: reports of hail, wind or tornadoes made to the National Weather Service by trained
      spotters, emergency managers, the public or instruments (preliminary, as issued).
      <strong>Radar-estimated</strong>: NEXRAD hail-algorithm output; indicates likely hail and its estimated maximum size.
      <strong>Official record</strong>: NWS-verified events in the NCEI Storm Events Database; zone-based events without
      coordinates are not included. <strong>Model-indicated</strong>: weather-model output, shown for context only and
      never used to verify an event. Retrieved ${escapeHtml(formatUtc(evidence.generatedAt))}.
    </p>`;
}

// ---------------------------------------------------------------------------
// Hail swath map (MRMS MESH polygons over a Web Mercator base map)
// ---------------------------------------------------------------------------

/** Light → deep purple by hail size (inches), echoing common hail-map palettes. */
const BAND_COLORS: Record<string, string> = {
  '0.5': '#E2D3F0',
  '0.75': '#C9A9E3',
  '1': '#A97BD2',
  '1.5': '#8550BD',
  '2': '#62309F',
  '2.5': '#3F1673',
};
const WIND_COLOR = '#F28C28';
const TORNADO_COLOR = '#D7263D';

function bandColor(minIn: number) {
  return BAND_COLORS[String(minIn)] || '#62309F';
}

function mercY(lat: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

/** lon/lat → pixel projection for a Web Mercator image covering exactly `bounds`. */
function projector(bounds: GeoBounds, width: number, height: number) {
  const top = mercY(bounds.north);
  const span = top - mercY(bounds.south);
  return (lon: number, lat: number): [number, number] => [
    ((lon - bounds.west) / (bounds.east - bounds.west)) * width,
    ((top - mercY(lat)) / span) * height,
  ];
}

/** Ring of points `miles` from the origin (geodesic), for the search-radius circle. */
function circlePoints(lat: number, lon: number, miles: number, steps = 72): [number, number][] {
  const d = miles / 3958.8;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = (i / steps) * 2 * Math.PI;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    points.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI]);
  }
  return points;
}

function pathFrom(points: [number, number][]) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('') + 'Z';
}

function renderSwathMap(evidence: WeatherEvidence, baseMap: SwathBaseMap | null) {
  const swath = evidence.swath;
  if (!swath) {
    return `<p class="narrative">A hail swath map could not be produced for this report (MRMS radar data unavailable).</p>`;
  }
  const width = baseMap?.width ?? 1200;
  const height = baseMap?.height ?? Math.round(width / swath.aspect);
  const project = projector(swath.bounds, width, height);
  const { latitude, longitude, eventRadiusMiles } = evidence.query;

  const bands = [...swath.bands]
    .sort((a, b) => a.minIn - b.minIn)
    .map((band) => {
      const d = band.geometry.coordinates
        .map((polygon) => polygon.map((ring) => pathFrom(ring.map(([lon, lat]) => project(lon, lat)))).join(''))
        .join('');
      return `<path d="${d}" fill="${bandColor(band.minIn)}" fill-opacity="0.62" fill-rule="evenodd" stroke="${bandColor(band.minIn)}" stroke-width="1"/>`;
    })
    .join('');

  const circle = pathFrom(circlePoints(latitude, longitude, eventRadiusMiles).map(([lon, lat]) => project(lon, lat)));
  const [px, py] = project(longitude, latitude);

  const markers = evidence.observedReports
    .map((r) => {
      const [x, y] = project(r.longitude, r.latitude);
      if (r.type === 'hail') return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#3F1673" stroke="#fff" stroke-width="2"/>`;
      const color = r.type === 'tornado' ? TORNADO_COLOR : WIND_COLOR;
      return `<path d="M${x.toFixed(1)} ${(y - 9).toFixed(1)}L${(x + 8).toFixed(1)} ${(y + 6).toFixed(1)}L${(x - 8).toFixed(1)} ${(y + 6).toFixed(1)}Z" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    })
    .join('');

  // The roads overlay includes every street at this scale; keep it faint so swaths stay readable.
  const layerOpacity: Record<string, number> = { imagery: 1, roads: 0.35, labels: 1 };
  const layers = baseMap
    ? baseMap.layers
        .map(
          (layer) =>
            `<img class="swath-layer" src="${layer.dataUri}" style="opacity:${layerOpacity[layer.id] ?? 1}" alt=""/>`
        )
        .join('')
    : '<div class="swath-layer swath-blank"></div>';

  const legendBands = swath.thresholdsIn
    .filter((t) => swath.bands.some((b) => b.minIn === t))
    .map((t) => `<span class="legend-item"><span class="legend-swatch" style="background:${bandColor(t)}"></span>≥ ${t}"</span>`)
    .join('');

  const mesh = evidence.hail.mesh;
  return `
    <div class="swath-map" style="padding-top:${((height / width) * 100).toFixed(3)}%">
      ${layers}
      <svg class="swath-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        ${bands}
        <path d="${circle}" fill="none" stroke="#E01E2D" stroke-width="4"/>
        ${markers}
        <g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})">
          <path d="M0 0 C-7 -10 -12 -16 -12 -24 A12 12 0 1 1 12 -24 C12 -16 7 -10 0 0Z" fill="#E01E2D" stroke="#fff" stroke-width="2.5"/>
          <circle cx="0" cy="-24" r="4.5" fill="#fff"/>
        </g>
      </svg>
    </div>
    <div class="legend">
      <span class="legend-title">Estimated hail size (MRMS MESH):</span>${legendBands || '<span class="legend-item">no hail ≥ 0.5" in this area</span>'}
      <span class="legend-item"><span class="legend-dot" style="background:#3F1673"></span>Hail report</span>
      <span class="legend-item"><span class="legend-tri" style="border-bottom-color:${WIND_COLOR}"></span>Wind report</span>
      <span class="legend-item"><span class="legend-tri" style="border-bottom-color:${TORNADO_COLOR}"></span>Tornado report</span>
      <span class="legend-item"><span class="legend-ring"></span>${eventRadiusMiles} mi search radius</span>
    </div>
    <p class="note">
      Hail swath: NOAA MRMS Maximum Estimated Size of Hail, 24-hour maximum for ${escapeHtml(swath.days.join(', '))} (UTC),
      ~1 km resolution. Radar-estimated, not ground measurements.
      ${mesh?.atPropertyIn != null ? `Estimated maximum at the property: <strong>${mesh.atPropertyIn.toFixed(2)}"</strong>.` : ''}
      ${baseMap ? escapeHtml(baseMap.attribution) + '.' : ''}
    </p>`;
}

export function renderWeatherEvidence(
  address: string,
  evidence: WeatherEvidence,
  mapsHtml: string,
  swathBaseMap: SwathBaseMap | null = null
) {
  const { query } = evidence;
  const observedHail = evidence.hail.observed;
  const radarHail = evidence.hail.radar;
  const model = evidence.model;

  const largestReported = observedHail.count
    ? `${(observedHail.maxSizeIn ?? 0).toFixed(2)}" (${observedHail.count} report${observedHail.count === 1 ? '' : 's'})`
    : 'None reported';
  const largestRadar = radarHail.count
    ? `${(radarHail.maxSizeIn ?? 0).toFixed(2)}" estimated (${radarHail.count} signature${radarHail.count === 1 ? '' : 's'})`
    : 'None detected';
  const nearestHail = observedHail.nearest || radarHail.nearest;

  return `
    <div class="section page-break">
      <h2>Verified Weather Data</h2>
      <div class="evidence-banner level-${evidence.level}">
        <div class="evidence-level">${escapeHtml(LEVEL_LABEL[evidence.level])}</div>
        <div class="evidence-headline">${escapeHtml(evidence.headline)}</div>
      </div>

      <h3>Report Information</h3>
      ${infoRow('Weather report ID', weatherReportId(evidence))}
      ${infoRow('Property address', address)}
      ${infoRow('Coordinates', `${query.latitude.toFixed(5)}, ${query.longitude.toFixed(5)}`)}
      ${infoRow('Date of loss', formatUtc(query.dateOfLoss, false))}
      ${infoRow('Search window', `${formatUtc(query.windowStart)} – ${formatUtc(query.windowEnd)}`)}
      ${infoRow('Search radius', `${query.eventRadiusMiles} miles`)}
      ${infoRow('Data retrieved', formatUtc(evidence.generatedAt))}

      <h3>Hail Swath Map</h3>
      ${renderSwathMap(evidence, swathBaseMap)}

      <h3>Event Verification — Observed Reports</h3>
      ${renderObservedReports(evidence)}

      <h3>Hail Size</h3>
      ${infoRow('Largest reported hail (observed)', largestReported)}
      ${infoRow('Largest radar-estimated hail (NEXRAD signatures)', largestRadar)}
      ${
        evidence.hail.mesh
          ? `${infoRow(
              'Estimated hail at the property (MRMS)',
              evidence.hail.mesh.atPropertyIn ? `${evidence.hail.mesh.atPropertyIn.toFixed(2)}"` : 'None estimated'
            )}
             ${infoRow(
               `Largest estimated hail within ${query.eventRadiusMiles} mi (MRMS)`,
               evidence.hail.mesh.maxWithinRadiusIn
                 ? `${evidence.hail.mesh.maxWithinRadiusIn.toFixed(2)}"${
                     evidence.hail.mesh.maxWithinRadiusAt
                       ? ` (${evidence.hail.mesh.maxWithinRadiusAt.distanceMiles.toFixed(1)} mi ${evidence.hail.mesh.maxWithinRadiusAt.direction})`
                       : ''
                   }`
                 : 'None estimated'
             )}`
          : ''
      }
      ${infoRow('Nearest hail evidence', nearestHail ? `${distanceText(nearestHail)} · ${KIND_LABEL[nearestHail.evidence]}` : '—')}
      ${infoRow('Strongest reported wind', evidence.wind.observed.maxMph != null ? `${Math.round(evidence.wind.observed.maxMph)} mph` : 'None reported')}

      <h3>Radar-Estimated Hail (NEXRAD)</h3>
      ${renderRadarDetections(evidence)}
    </div>

    <div class="section page-break">
      <h2>Weather History</h2>
      ${renderHistory(evidence)}

      ${
        model
          ? `<h3>Supporting Model Data</h3>
             ${infoRow('Thunderstorm indicated (model)', model.thunderFound ? 'Yes' : 'No')}
             ${infoRow('Peak wind (model)', model.windMph != null ? `${Math.round(model.windMph)} mph` : '—')}
             ${infoRow('Rain (model)', model.rainIn != null ? `${model.rainIn.toFixed(2)} in` : '—')}
             <p class="note">Weather-model values (Open-Meteo) are shown for context only and are not used to verify the event.</p>`
          : ''
      }

      ${mapsHtml}

      <h3>Data Sources and Methodology</h3>
      ${renderSources(evidence)}
    </div>`;
}

