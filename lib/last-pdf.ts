import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const LAST_PDF_FILE = `${FileSystem.documentDirectory ?? ''}claimcapture-last-pdf.json`;

type LastPdf = {
  jobId: string;
  uri: string;
  createdAt: string;
};

export async function saveLastPdf(jobId: string, uri: string): Promise<void> {
  if (!FileSystem.documentDirectory || !jobId || !uri) return;
  try {
    const payload: LastPdf = { jobId, uri, createdAt: new Date().toISOString() };
    await FileSystem.writeAsStringAsync(LAST_PDF_FILE, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export async function loadLastPdf(jobId?: string): Promise<string | null> {
  if (!FileSystem.documentDirectory) return null;
  try {
    const info = await FileSystem.getInfoAsync(LAST_PDF_FILE);
    if (!info.exists) return null;
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(LAST_PDF_FILE)) as LastPdf;
    if (jobId && parsed.jobId !== jobId) return null;
    const pdfInfo = await FileSystem.getInfoAsync(parsed.uri);
    return pdfInfo.exists ? parsed.uri : null;
  } catch {
    return null;
  }
}
