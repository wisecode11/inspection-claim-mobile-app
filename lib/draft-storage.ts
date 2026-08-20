import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { InspectionData } from '@/lib/inspection-types';

const WEB_PREFIX = 'claimcapture_draft_';

function draftPath(jobId: string) {
  const safe = jobId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${FileSystem.documentDirectory ?? ''}claimcapture-draft-${safe}.json`;
}

export async function loadDraft(jobId: string): Promise<InspectionData | null> {
  if (!jobId) return null;

  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(`${WEB_PREFIX}${jobId}`);
      return raw ? (JSON.parse(raw) as InspectionData) : null;
    }

    if (!FileSystem.documentDirectory) return null;
    const path = draftPath(jobId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as InspectionData;
  } catch {
    return null;
  }
}

export async function saveDraft(jobId: string, data: InspectionData): Promise<void> {
  if (!jobId) return;

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(`${WEB_PREFIX}${jobId}`, JSON.stringify(data));
      return;
    }

    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(draftPath(jobId), JSON.stringify(data));
  } catch {
    // Auto-save should never crash the capture flow.
  }
}

export async function clearDraft(jobId: string): Promise<void> {
  if (!jobId) return;

  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(`${WEB_PREFIX}${jobId}`);
      return;
    }

    if (!FileSystem.documentDirectory) return;
    const path = draftPath(jobId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    // ignore
  }
}
