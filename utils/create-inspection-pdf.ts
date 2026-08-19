import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

type ReportData = {
  customer: string;
  address: string;
  date: string;
  photos: string[];
  roofSlope: string;
  roofType: string;
  roofCondition: string;
  roofNotes: string;
  hailArea: string;
  hailSize: string;
  hailImpacts: string;
  hailNotes: string;
  damageType: string;
  damageLocation: string;
  damageSeverity: string;
  damageNotes: string;
  collateralDamage: string[];
  weatherStatus: string;
};

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

async function embedPhotos(photoUris: string[]) {
  const embedded: string[] = [];
  const photos = photoUris.slice(0, 8);

  for (const uri of photos) {
    try {
      const dataUri = await withTimeout(photoToDataUri(uri), 8000, 'Photo convert');
      if (dataUri) embedded.push(dataUri);
    } catch {
      // Skip photos that fail or take too long so the PDF still generates.
    }
  }

  return embedded;
}

function photoSectionHtml(photoDataUris: string[]) {
  if (photoDataUris.length === 0) {
    return `<div class="card"><h2>Inspection Photos</h2><p class="empty">No inspection photos were captured.</p></div>`;
  }

  const items = photoDataUris
    .map(
      (src, index) => `
        <div class="photo">
          <img src="${src}" />
          <div class="caption">Photo ${index + 1}</div>
        </div>`
    )
    .join('');

  return `<div class="card"><h2>Inspection Photos (${photoDataUris.length})</h2><div class="photos">${items}</div></div>`;
}

function buildReportHtml(data: ReportData, photoDataUris: string[]) {
  const hailResult = `${data.hailImpacts} impacts / ${data.hailArea} sq ft`;
  const collateral =
    data.collateralDamage.length > 0 ? data.collateralDamage.join(', ') : 'No collateral damage';

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #163A4A; padding: 28px; }
        h1 { font-size: 28px; margin: 0 0 6px; }
        .brand { color: #E17035; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
        .sub { color: #70818A; margin-bottom: 24px; }
        .card { border: 1px solid #D8E0E4; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EDF1F2; }
        .row:last-child { border-bottom: none; }
        .label { color: #70818A; }
        .value { font-weight: 700; text-align: right; max-width: 60%; }
        h2 { font-size: 18px; margin: 0 0 12px; }
        .empty { color: #70818A; margin: 0; }
        .photos { display: block; }
        .photo { margin: 0 0 18px; page-break-inside: avoid; }
        .photo img { width: 100%; height: auto; border-radius: 8px; background: #F4F7F8; }
        .caption { color: #70818A; font-size: 12px; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="brand">ROOFCHECK INSPECTION REPORT</div>
      <h1>${escapeHtml(data.customer)}</h1>
      <div class="sub">${escapeHtml(data.address)}<br/>Inspection Date: ${escapeHtml(data.date)} • Inspector: Alex Johnson</div>

      <div class="card">
        <div class="row"><span class="label">Photos</span><span class="value">${data.photos.length}</span></div>
        <div class="row"><span class="label">Roof Slope</span><span class="value">${escapeHtml(data.roofSlope)}</span></div>
        <div class="row"><span class="label">Roof Type</span><span class="value">${escapeHtml(data.roofType)}</span></div>
        <div class="row"><span class="label">Roof Condition</span><span class="value">${escapeHtml(data.roofCondition)}</span></div>
        <div class="row"><span class="label">Roof Notes</span><span class="value">${escapeHtml(data.roofNotes || 'None')}</span></div>
      </div>

      <div class="card">
        <div class="row"><span class="label">Hail Test</span><span class="value">${escapeHtml(hailResult)}</span></div>
        <div class="row"><span class="label">Hail Size</span><span class="value">${escapeHtml(data.hailSize)}</span></div>
        <div class="row"><span class="label">Hail Notes</span><span class="value">${escapeHtml(data.hailNotes || 'None')}</span></div>
      </div>

      <div class="card">
        <div class="row"><span class="label">Damage Found</span><span class="value">${escapeHtml(data.damageType)}</span></div>
        <div class="row"><span class="label">Location</span><span class="value">${escapeHtml(data.damageLocation)}</span></div>
        <div class="row"><span class="label">Severity</span><span class="value">${escapeHtml(data.damageSeverity)}</span></div>
        <div class="row"><span class="label">Damage Notes</span><span class="value">${escapeHtml(data.damageNotes || 'None')}</span></div>
        <div class="row"><span class="label">Collateral</span><span class="value">${escapeHtml(collateral)}</span></div>
        <div class="row"><span class="label">Weather</span><span class="value">${escapeHtml(data.weatherStatus)}</span></div>
      </div>

      ${photoSectionHtml(photoDataUris)}
    </body>
  </html>`;
}

function reportFileName(customer: string) {
  const safeName = customer.replace(/[^a-zA-Z0-9]+/g, '_');
  return `RoofCheck_${safeName}_${Date.now()}.pdf`;
}

export async function createInspectionPdf(data: ReportData) {
  const photos = await embedPhotos(data.photos);
  const html = buildReportHtml(data, photos);

  try {
    const file = await withTimeout(
      Print.printToFileAsync({ html, base64: false }),
      20000,
      'PDF create'
    );
    const destination = `${FileSystem.documentDirectory}${reportFileName(data.customer)}`;
    await FileSystem.copyAsync({ from: file.uri, to: destination });
    return destination;
  } catch {
    const fallbackHtml = buildReportHtml(data, []);
    const file = await withTimeout(
      Print.printToFileAsync({ html: fallbackHtml, base64: false }),
      15000,
      'PDF fallback'
    );
    const destination = `${FileSystem.documentDirectory}${reportFileName(data.customer)}`;
    await FileSystem.copyAsync({ from: file.uri, to: destination });
    return destination;
  }
}

export async function viewInspectionPdf(uri: string) {
  await Print.printAsync({ uri });
}

export async function shareInspectionPdf(uri: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Inspection Report',
    UTI: 'com.adobe.pdf',
  });
}

function fileNameFromUri(uri: string) {
  return uri.split('/').pop() ?? `RoofCheck_Report_${Date.now()}.pdf`;
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

  return `PDF saved on this device as ${fileName}. Open the Files app and look under RoofCheck.`;
}
