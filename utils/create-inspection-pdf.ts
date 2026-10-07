import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import {
  EVIDENCE_SECTION_ORDER,
  type EvidenceSectionId,
  type PhotoItem,
  routePhotoToSection,
  sectionTitle,
} from '@/lib/capture-steps';
import type { SwathBaseMap } from '@/lib/api';
import type { InspectionData } from '@/lib/inspection-types';
import { escapeHtml, infoRow, REPORT_CSS } from '@/utils/pdf-html';
import { renderWeatherEvidence } from '@/utils/weather-evidence-html';
import {
  codesAndStandardsHtml,
  damageDefinitionsHtml,
  disclaimerHtml,
  existingConditionsHtml,
  inspectorDeclarationHtml,
  investigationProcessHtml,
  photographicEvidenceIntroHtml,
  summaryOfFindingsHtml,
  type ReportLanguagePackage,
} from '@/lib/report-templates';

const CLIENT_SECTION_TITLES: Partial<Record<EvidenceSectionId, string>> = {
  elevations: 'Elevations',
  collateral: 'Collateral Damage',
  spatter: 'Spatter',
  metal: 'Hail Impacts - Metal',
  shingles: 'Hail Impacts - Shingles',
  'hail-bruising': 'Hail Bruising',
  'test-squares': 'Test Squares',
  'wear-tear': 'Wear and Tear',
  'tie-ins': 'Roof Tie-Ins',
  'roof-overviews': 'Overview',
  'build-notes': 'Build Notes',
};

function clientSectionTitle(sectionId: EvidenceSectionId) {
  return CLIENT_SECTION_TITLES[sectionId] || sectionTitle(sectionId);
}


function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function photoToDataUri(uri: string, opts?: { wider?: boolean }) {
  const targetWidth = opts?.wider ? 1200 : 720;
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: targetWidth } }],
    {
      compress: opts?.wider ? 0.72 : 0.62,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
  if (!resized.base64) return null;
  return `data:image/jpeg;base64,${resized.base64}`;
}

async function embedPhotoMap(photos: PhotoItem[]) {
  const map = new Map<string, string>();
  for (const photo of photos.slice(0, 80)) {
    try {
      const annotated =
        /annotated/i.test(photo.label) ||
        (Array.isArray(photo.annotations) && photo.annotations.length > 0);
      const dataUri = await withTimeout(
        photoToDataUri(photo.uri, { wider: annotated }),
        10000,
        'Photo convert'
      );
      if (dataUri) map.set(photo.id, dataUri);
    } catch {
      // Skip failed photos.
    }
  }
  return map;
}


function photoCaption(photo: PhotoItem) {
  return [
    photo.label,
    photo.component,
    photo.elevation,
    photo.roofDirection,
    photo.shotType && photo.shotType !== 'standard' ? photo.shotType : '',
    photo.damageTags.join(', '),
    photo.notes,
  ]
    .filter(Boolean)
    .join(' · ');
}

function renderPhotos(photos: PhotoItem[], embedded: Map<string, string>) {
  return photos
    .map((photo) => {
      const src = embedded.get(photo.id);
      if (!src) return '';
      const annotated =
        /annotated/i.test(photo.label) ||
        (Array.isArray(photo.annotations) && photo.annotations.length > 0);
      return `
        <div class="photo-block${annotated ? ' photo-block-annotated' : ''}">
          <img class="${annotated ? 'annotated' : ''}" src="${src}" />
          <div class="caption">${escapeHtml(photoCaption(photo) || 'Photographic evidence')}</div>
        </div>`;
    })
    .join('');
}

function renderFindingsIndex(bySection: Map<string, PhotoItem[]>) {
  const items: string[] = [];

  for (const sectionId of EVIDENCE_SECTION_ORDER) {
    if (sectionId === 'build-notes') continue;
    const photos = bySection.get(sectionId) ?? [];
    if (photos.length === 0) continue;

    const title = clientSectionTitle(sectionId);
    const tags = new Set<string>();
    for (const photo of photos) {
      for (const tag of photo.damageTags) tags.add(tag);
      if (photo.component) tags.add(photo.component);
    }
    const detail =
      tags.size > 0
        ? [...tags].slice(0, 8).join('; ')
        : `${photos.length} photo${photos.length === 1 ? '' : 's'} documented`;

    items.push(`<li><strong>${escapeHtml(title)}:</strong> ${escapeHtml(detail)}</li>`);
  }

  if (items.length === 0) {
    return `<p class="narrative">No photographic sections were populated for this inspection.</p>`;
  }
  return `<ul class="bullets">${items.join('')}</ul>`;
}

function renderPropertyMaps(maps?: { roadmap: string | null; satellite: string | null } | null) {
  if (!maps?.roadmap && !maps?.satellite) return '';

  const cell = (src: string, alt: string, extraClass = '') => `
    <div class="map-cell${extraClass ? ` ${extraClass}` : ''}">
      <img class="map-shot" src="${src}" alt="${alt}" />
      <div class="map-pin" aria-hidden="true"></div>
    </div>`;

  return `
    <h3>Property Location</h3>
    <div class="map-row">
      ${maps.roadmap ? cell(maps.roadmap, 'Property roadmap') : ''}
      ${maps.satellite ? cell(maps.satellite, 'Property satellite', 'map-cell-second') : ''}
    </div>`;
}

function renderWeather(
  data: InspectionData,
  maps?: { roadmap: string | null; satellite: string | null } | null,
  swathBaseMap: SwathBaseMap | null = null
) {
  if (data.weatherEvidence) {
    return renderWeatherEvidence(data.address, data.weatherEvidence, renderPropertyMaps(maps), swathBaseMap);
  }

  // Older drafts without NOAA evidence: show the summary, clearly labelled as model-based.
  const weather = data.weatherSummary;
  if (!weather) {
    return `
      <div class="section page-break">
        <h2>Verified Weather Data</h2>
        <p class="narrative">
          Weather verification was not available for this inspection at the time of report generation.
          Photographic and field findings below remain valid independently of third-party weather confirmation.
        </p>
        <h3>Overall Weather History</h3>
        ${renderPropertyMaps(maps)}
      </div>`;
  }

  return `
    <div class="section page-break">
      <h2>Verified Weather Data</h2>
      <p class="narrative">
        An extreme hail, wind, or tornado event was evaluated for the subject property at
        <strong>${escapeHtml(data.address)}</strong>.
      </p>
      <h3>Report Information</h3>
      ${infoRow('Address', data.address)}
      ${infoRow('Owner / Contact', data.homeownerName || data.customer)}
      ${infoRow('Data Period / Storm Date', weather.stormDate)}
      ${infoRow('Status', weather.badgeTitle)}
      ${infoRow('Detail', weather.badgeSub)}
      ${infoRow('Weather', weather.weather)}
      ${infoRow('Hail recorded', weather.hail)}
      ${infoRow('Wind', weather.wind)}
      ${infoRow('Rain', weather.rain)}
      ${infoRow('Storm match', weather.stormMatch)}
      <p class="note">
        These values come from a historical weather model (Open-Meteo) captured before NOAA storm-report
        verification was available for this job. Model output indicates conditions only; it is not an observed
        or radar measurement of hail at the property. Regenerate the report while online to include NOAA evidence.
      </p>
      ${renderPropertyMaps(maps)}
    </div>`;
}

function renderBuildNotes(
  data: InspectionData,
  bySection: Map<string, PhotoItem[]>,
  embedded: Map<string, string>
) {
  const fieldRows = Object.entries(data.buildNotes.fields)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => infoRow(key, value))
    .join('');
  const textRows = Object.entries(data.buildNotes.texts)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => infoRow(key, value))
    .join('');
  const tieIns =
    data.buildNotes.selectedTieIns.length > 0
      ? infoRow('Roof tie-ins', data.buildNotes.selectedTieIns.join(', '))
      : '';
  const photos = bySection.get('build-notes') ?? [];

  if (!fieldRows && !textRows && !tieIns && photos.length === 0) return '';

  return `
    <div class="section page-break">
      <div class="section-banner">Build Notes</div>
      ${fieldRows}
      ${textRows}
      ${tieIns}
      ${photos.length > 0 ? renderPhotos(photos, embedded) : ''}
    </div>`;
}

function buildReportHtml(
  data: InspectionData,
  embedded: Map<string, string>,
  language?: ReportLanguagePackage | null,
  maps?: { roadmap: string | null; satellite: string | null } | null,
  swathBaseMap: SwathBaseMap | null = null
) {
  const bySection = new Map<string, PhotoItem[]>();
  const reportPhotos = data.photos.filter((photo) => photo.includeInReport !== false);
  for (const photo of reportPhotos) {
    const section = routePhotoToSection(photo);
    const list = bySection.get(section) ?? [];
    list.push(photo);
    bySection.set(section, list);
  }

  const cover =
    reportPhotos.find((photo) => photo.isCover) ||
    reportPhotos.find((photo) => photo.stepId === 'elevations' && photo.label === 'Front') ||
    reportPhotos[0];
  const coverSrc = cover ? embedded.get(cover.id) : null;

  const inspector = data.inspectorName || 'Inspector';
  const homeowner = data.homeownerName || data.customer || 'Property Owner';
  const roofAge = data.estimatedRoofAge || 'unknown age';
  const inspectionDate = data.date || '—';
  const dateOfLoss = data.dateOfLoss ? String(data.dateOfLoss).slice(0, 10) : '—';

  const photoSections = EVIDENCE_SECTION_ORDER.filter((id) => id !== 'build-notes')
    .map((sectionId) => {
      const photos = bySection.get(sectionId) ?? [];
      if (photos.length === 0) return '';
      const title = clientSectionTitle(sectionId);
      return `
        <div class="section page-break">
          <div class="section-banner">${escapeHtml(title)}</div>
          <p class="section-count">${photos.length} photograph${photos.length === 1 ? '' : 's'}</p>
          ${renderPhotos(photos, embedded)}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${REPORT_CSS}
  </style>
</head>
<body>
  <div class="page">
    <h1>Property Damage Assessment Summary</h1>

    <div class="block">
      <h2>Assigned Inspector</h2>
      ${infoRow('Inspector', inspector)}
      ${infoRow('Email', data.email)}
      ${infoRow('Phone', data.phone)}
    </div>

    <div class="block">
      <h2>Property Information</h2>
      ${infoRow('Property Address', data.address)}
      ${infoRow('Owner / Contact', homeowner)}
      ${infoRow('Date of Inspection', inspectionDate)}
      ${infoRow('Date of Loss (If known)', dateOfLoss)}
      ${infoRow('Policy Number', data.policyNumber)}
      ${infoRow('Claim Number', data.claimNumber)}
      ${infoRow('Estimated Roof Age', roofAge)}
    </div>

    ${coverSrc ? `<img class="cover" src="${coverSrc}" />` : ''}

    <div class="block">
      <h2>Summary of Findings</h2>
      ${summaryOfFindingsHtml(language)}
    </div>

    <div class="block">
      <h2>Investigation Process</h2>
      ${investigationProcessHtml(language)}
    </div>

    <div class="section page-break">
      <h2>Damage Definitions and Assessment Criteria</h2>
      ${damageDefinitionsHtml(language)}
    </div>

    ${renderWeather(data, maps, swathBaseMap)}

    <div class="section page-break">
      <h2>Photographic Evidence and Supporting Documentation</h2>
      ${photographicEvidenceIntroHtml()}
      <h3>Index of Documented Findings</h3>
      ${renderFindingsIndex(bySection)}
    </div>

    ${photoSections}

    ${renderBuildNotes(data, bySection, embedded)}

    <div class="section page-break">
      <h2>Existing Conditions</h2>
      ${existingConditionsHtml(roofAge, language)}
    </div>

    <div class="section page-break">
      <h2>Codes and Standards</h2>
      ${codesAndStandardsHtml(language)}
    </div>

    ${disclaimerHtml(language)}

    <div class="section page-break">
      <h2>Inspector’s Declaration</h2>
      ${inspectorDeclarationHtml(escapeHtml(inspector))}
    </div>

    <div class="footer">
      ClaimCapture Evidence Package · Generated for claim documentation ·
      ${escapeHtml(homeowner)} · ${escapeHtml(data.address)}
    </div>
  </div>
</body>
</html>`;
}

function reportFileName(customer: string) {
  const safeName = customer.replace(/[^a-zA-Z0-9]+/g, '_') || 'Property';
  return `ClaimCapture_${safeName}_${Date.now()}.pdf`;
}

export async function createInspectionPdf(
  data: InspectionData,
  language?: ReportLanguagePackage | null,
  maps?: { roadmap: string | null; satellite: string | null } | null,
  swathBaseMap: SwathBaseMap | null = null
) {
  const reportPhotos = data.photos.filter((photo) => photo.includeInReport !== false);
  const embedded = await embedPhotoMap(reportPhotos);
  const html = buildReportHtml(data, embedded, language, maps, swathBaseMap);

  try {
    const file = await withTimeout(
      Print.printToFileAsync({ html, base64: false }),
      45000,
      'PDF create'
    );
    const destination = `${FileSystem.documentDirectory}${reportFileName(
      data.homeownerName || data.customer
    )}`;
    await FileSystem.copyAsync({ from: file.uri, to: destination });
    return destination;
  } catch {
    const fallbackHtml = buildReportHtml(data, new Map(), language, maps, swathBaseMap);
    const file = await withTimeout(
      Print.printToFileAsync({ html: fallbackHtml, base64: false }),
      20000,
      'PDF fallback'
    );
    const destination = `${FileSystem.documentDirectory}${reportFileName(
      data.homeownerName || data.customer
    )}`;
    await FileSystem.copyAsync({ from: file.uri, to: destination });
    return destination;
  }
}

export async function viewInspectionPdf(uri: string) {
  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
      return;
    } catch {
      // Fall through.
    }

    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await Linking.openURL(contentUri);
      return;
    } catch {
      // Fall through.
    }
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Open Evidence Package',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  if (Platform.OS === 'ios') {
    await Print.printAsync({ uri });
    return;
  }

  throw new Error('Could not open the PDF on this device. Try Share or Download instead.');
}

export async function shareInspectionPdf(uri: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Evidence Package',
    UTI: 'com.adobe.pdf',
  });
}

function fileNameFromUri(uri: string) {
  return uri.split('/').pop() ?? `ClaimCapture_Report_${Date.now()}.pdf`;
}

export async function downloadInspectionPdf(uri: string) {
  const fileName = fileNameFromUri(uri);

  if (Platform.OS === 'android') {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Folder access was not granted.');
    }

    const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      nameWithoutExt,
      'application/pdf'
    );
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: 'base64' });
    return 'PDF saved to the folder you selected.';
  }

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('PDF file was not found.');
  }

  return `PDF saved on this device as ${fileName}.`;
}
