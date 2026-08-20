import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import {
  EVIDENCE_SECTION_ORDER,
  PhotoItem,
  routePhotoToSection,
  sectionTitle,
} from '@/lib/capture-steps';
import type { InspectionData } from '@/lib/inspection-types';
import {
  codesAndStandardsHtml,
  damageDefinitionsHtml,
  existingConditionsHtml,
  inspectorDeclarationHtml,
  summaryOfFindingsHtml,
} from '@/lib/report-templates';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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

async function photoToDataUri(uri: string) {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 640 } }],
    {
      compress: 0.4,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!resized.base64) return null;
  return `data:image/jpeg;base64,${resized.base64}`;
}

async function embedPhotoMap(photos: PhotoItem[]) {
  const map = new Map<string, string>();
  const limited = photos.slice(0, 40);

  for (const photo of limited) {
    try {
      const dataUri = await withTimeout(photoToDataUri(photo.uri), 8000, 'Photo convert');
      if (dataUri) map.set(photo.id, dataUri);
    } catch {
      // Skip failed photos.
    }
  }

  return map;
}

function row(label: string, value: string) {
  return `<div class="row"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value || '—')}</span></div>`;
}

function photoCardsHtml(photos: PhotoItem[], embedded: Map<string, string>) {
  return photos
    .map((photo) => {
      const src = embedded.get(photo.id);
      if (!src) return '';
      const meta = [
        photo.label,
        photo.component,
        photo.elevation,
        photo.roofDirection,
        photo.shotType && photo.shotType !== 'standard' ? photo.shotType : '',
        photo.damageTags.join(', '),
      ]
        .filter(Boolean)
        .join(' · ');
      return `
        <div class="photo">
          <img src="${src}" />
          <div class="caption">${escapeHtml(meta || 'Photo')}</div>
        </div>`;
    })
    .join('');
}

function buildReportHtml(data: InspectionData, embedded: Map<string, string>) {
  const cover =
    data.photos.find((photo) => photo.isCover) ||
    data.photos.find((photo) => photo.stepId === 'elevations' && photo.label === 'Front') ||
    data.photos[0];
  const coverSrc = cover ? embedded.get(cover.id) : null;
  const inspector = data.inspectorName || 'Inspector';
  const homeowner = data.homeownerName || data.customer;
  const roofAge = data.estimatedRoofAge || 'unknown age';

  const bySection = new Map<string, PhotoItem[]>();
  for (const photo of data.photos) {
    const section = routePhotoToSection(photo);
    const list = bySection.get(section) ?? [];
    list.push(photo);
    bySection.set(section, list);
  }

  const photoSectionsHtml = EVIDENCE_SECTION_ORDER.filter((sectionId) => sectionId !== 'build-notes')
    .map((sectionId) => {
      const photos = bySection.get(sectionId) ?? [];
      if (photos.length === 0) return '';
      return `
      <div class="card">
        <h2>${escapeHtml(sectionTitle(sectionId))} (${photos.length})</h2>
        <div class="photos">${photoCardsHtml(photos, embedded)}</div>
      </div>`;
    })
    .join('');

  const weatherHtml = data.weatherSummary
    ? `
      <div class="card">
        <h2>4. Hail Report / Weather Data</h2>
        ${row('Status', data.weatherSummary.badgeTitle)}
        ${row('Detail', data.weatherSummary.badgeSub)}
        ${row('Storm date', data.weatherSummary.stormDate)}
        ${row('Weather', data.weatherSummary.weather)}
        ${row('Hail', data.weatherSummary.hail)}
        ${row('Wind', data.weatherSummary.wind)}
        ${row('Rain', data.weatherSummary.rain)}
        ${row('Storm match', data.weatherSummary.stormMatch)}
      </div>`
    : '';

  const buildFieldRows = Object.entries(data.buildNotes.fields)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => row(key, value))
    .join('');
  const buildTextRows = Object.entries(data.buildNotes.texts)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => row(key, value))
    .join('');
  const tieIns =
    data.buildNotes.selectedTieIns.length > 0
      ? row('Roof tie-ins', data.buildNotes.selectedTieIns.join(', '))
      : '';
  const buildNotePhotos = bySection.get('build-notes') ?? [];
  const buildNotesHtml =
    buildFieldRows || buildTextRows || tieIns || buildNotePhotos.length > 0
      ? `
      <div class="card">
        <h2>Build Notes</h2>
        ${buildFieldRows}
        ${buildTextRows}
        ${tieIns}
        ${buildNotePhotos.length > 0 ? `<div class="photos">${photoCardsHtml(buildNotePhotos, embedded)}</div>` : ''}
      </div>`
      : '';

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Georgia, "Times New Roman", serif; color: #163A4A; padding: 0; margin: 0; }
        .page { padding: 28px 32px 40px; }
        .masthead { background: #163A4A; color: #fff; margin: -28px -32px 22px; padding: 22px 32px 18px; }
        .brand { color: #E17035; font-family: Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1.4px; }
        .masthead h1 { font-size: 28px; margin: 8px 0 4px; color: #fff; font-weight: 700; }
        .masthead .sub { color: #B7C9D0; margin: 0; line-height: 1.45; font-family: Helvetica, Arial, sans-serif; font-size: 13px; }
        h2 { font-family: Helvetica, Arial, sans-serif; font-size: 16px; margin: 0 0 12px; color: #163A4A; border-bottom: 2px solid #E17035; padding-bottom: 6px; }
        h3 { font-family: Helvetica, Arial, sans-serif; font-size: 13px; margin: 14px 0 6px; color: #345560; }
        .card { border: 1px solid #D8E0E4; border-radius: 10px; padding: 16px; margin-bottom: 14px; page-break-inside: avoid; background: #fff; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EDF1F2; font-family: Helvetica, Arial, sans-serif; font-size: 13px; }
        .row:last-child { border-bottom: none; }
        .label { color: #70818A; }
        .value { font-weight: 700; text-align: right; max-width: 62%; }
        .cover { width: 100%; border-radius: 8px; margin: 0 0 16px; border: 1px solid #D8E0E4; }
        .photo { margin: 0 0 16px; page-break-inside: avoid; }
        .photo img { width: 100%; height: auto; border-radius: 6px; background: #F4F7F8; }
        .caption { color: #70818A; font-family: Helvetica, Arial, sans-serif; font-size: 11px; margin-top: 6px; }
        .narrative { color: #345560; font-size: 13px; line-height: 1.55; margin: 0 0 8px; }
        .footer { margin-top: 24px; color: #84949C; font-family: Helvetica, Arial, sans-serif; font-size: 11px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="masthead">
          <div class="brand">CLAIMCAPTURE · EVIDENCE PACKAGE</div>
          <h1>${escapeHtml(homeowner)}</h1>
          <p class="sub">
            ${escapeHtml(data.address)}<br/>
            Inspection: ${escapeHtml(data.date || '—')} · Inspector: ${escapeHtml(inspector)}
            ${data.claimNumber ? ` · Claim #${escapeHtml(data.claimNumber)}` : ''}
          </p>
        </div>

        ${coverSrc ? `<img class="cover" src="${coverSrc}" />` : ''}

        <div class="card">
          <h2>1. Property / Cover</h2>
          ${row('Homeowner', homeowner)}
          ${row('Address', data.address)}
          ${row('Claim #', data.claimNumber)}
          ${row('Policy #', data.policyNumber)}
        </div>

        <div class="card">
          <h2>2. Assessment Summary</h2>
          ${row('Inspector', inspector)}
          ${row('Phone', data.phone)}
          ${row('Email', data.email)}
          ${row('Date of loss', data.dateOfLoss ? String(data.dateOfLoss).slice(0, 10) : '—')}
          ${row('Estimated roof age', data.estimatedRoofAge)}
          ${row('Total photos', String(data.photos.length))}
          ${row('Weather status', data.weatherSummary?.badgeTitle || data.weatherStatus || 'No data')}
        </div>

        <div class="card">
          <h2>3. Damage Definitions & Assessment Criteria</h2>
          ${damageDefinitionsHtml()}
        </div>

        <div class="card">
          <h2>Summary of Findings</h2>
          ${summaryOfFindingsHtml()}
        </div>

        ${weatherHtml}

        ${photoSectionsHtml}

        ${buildNotesHtml}

        <div class="card">
          <h2>Existing Conditions</h2>
          ${existingConditionsHtml(escapeHtml(roofAge))}
        </div>

        <div class="card">
          <h2>Codes and Standards</h2>
          ${codesAndStandardsHtml()}
        </div>

        <div class="card">
          <h2>Inspector’s Declaration</h2>
          ${inspectorDeclarationHtml(escapeHtml(inspector))}
        </div>

        <div class="footer">ClaimCapture Field Capture Flow v4 · Generated for claim documentation</div>
      </div>
    </body>
  </html>`;
}

function reportFileName(customer: string) {
  const safeName = customer.replace(/[^a-zA-Z0-9]+/g, '_') || 'Property';
  return `ClaimCapture_${safeName}_${Date.now()}.pdf`;
}

export async function createInspectionPdf(data: InspectionData) {
  const embedded = await embedPhotoMap(data.photos);
  const html = buildReportHtml(data, embedded);

  try {
    const file = await withTimeout(
      Print.printToFileAsync({ html, base64: false }),
      30000,
      'PDF create'
    );
    const destination = `${FileSystem.documentDirectory}${reportFileName(data.homeownerName || data.customer)}`;
    await FileSystem.copyAsync({ from: file.uri, to: destination });
    return destination;
  } catch {
    const fallbackHtml = buildReportHtml(data, new Map());
    const file = await withTimeout(
      Print.printToFileAsync({ html: fallbackHtml, base64: false }),
      15000,
      'PDF fallback'
    );
    const destination = `${FileSystem.documentDirectory}${reportFileName(data.homeownerName || data.customer)}`;
    await FileSystem.copyAsync({ from: file.uri, to: destination });
    return destination;
  }
}

export async function viewInspectionPdf(uri: string) {
  // Avoid Print.printAsync on Android — it restarts the activity and remounts the app to /jobs.
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
      // Fall through to share sheet / Linking.
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
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: 'base64',
    });

    return 'PDF saved to the folder you selected.';
  }

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('PDF file was not found.');
  }

  return `PDF saved on this device as ${fileName}.`;
}
