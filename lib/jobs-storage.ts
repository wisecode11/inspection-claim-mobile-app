import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { InspectionJob } from '@/lib/api';

const WEB_KEY = 'roofcheck_jobs_cache';
const JOBS_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-jobs-cache.json`;

type JobsCache = {
  updatedAt: string;
  jobs: InspectionJob[];
};

export async function loadCachedJobs(): Promise<InspectionJob[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(WEB_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as JobsCache;
      return Array.isArray(parsed.jobs) ? parsed.jobs : [];
    }

    if (!FileSystem.documentDirectory) return [];
    const info = await FileSystem.getInfoAsync(JOBS_FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(JOBS_FILE);
    const parsed = JSON.parse(raw) as JobsCache;
    return Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch {
    return [];
  }
}

export async function saveCachedJobs(jobs: InspectionJob[]): Promise<void> {
  const payload: JobsCache = {
    updatedAt: new Date().toISOString(),
    jobs,
  };

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(WEB_KEY, JSON.stringify(payload));
      return;
    }

    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(JOBS_FILE, JSON.stringify(payload));
  } catch {
    // Cache write should never block the jobs screen.
  }
}

export async function clearCachedJobs(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(WEB_KEY);
      return;
    }
    if (!FileSystem.documentDirectory) return;
    const info = await FileSystem.getInfoAsync(JOBS_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(JOBS_FILE, { idempotent: true });
    }
  } catch {
    // ignore
  }
}
