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

export type JobsViewMode = 'list' | 'grid';

const VIEW_WEB_KEY = 'roofcheck_jobs_view_mode';
const VIEW_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-jobs-view-mode.txt`;

export async function loadJobsViewMode(): Promise<JobsViewMode> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(VIEW_WEB_KEY);
      return raw === 'grid' ? 'grid' : 'list';
    }
    if (!FileSystem.documentDirectory) return 'list';
    const info = await FileSystem.getInfoAsync(VIEW_FILE);
    if (!info.exists) return 'list';
    const raw = await FileSystem.readAsStringAsync(VIEW_FILE);
    return raw.trim() === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export async function saveJobsViewMode(mode: JobsViewMode): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(VIEW_WEB_KEY, mode);
      return;
    }
    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(VIEW_FILE, mode);
  } catch {
    // Preference write should never block the jobs screen.
  }
}

export type JobsSortMode = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'status';

const SORT_WEB_KEY = 'roofcheck_jobs_sort_mode';
const SORT_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-jobs-sort-mode.txt`;
const SORT_MODES: JobsSortMode[] = ['newest', 'oldest', 'nameAsc', 'nameDesc', 'status'];

function isJobsSortMode(value: string): value is JobsSortMode {
  return SORT_MODES.includes(value as JobsSortMode);
}

export async function loadJobsSortMode(): Promise<JobsSortMode> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(SORT_WEB_KEY);
      return raw && isJobsSortMode(raw) ? raw : 'newest';
    }
    if (!FileSystem.documentDirectory) return 'newest';
    const info = await FileSystem.getInfoAsync(SORT_FILE);
    if (!info.exists) return 'newest';
    const raw = (await FileSystem.readAsStringAsync(SORT_FILE)).trim();
    return isJobsSortMode(raw) ? raw : 'newest';
  } catch {
    return 'newest';
  }
}

export async function saveJobsSortMode(mode: JobsSortMode): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(SORT_WEB_KEY, mode);
      return;
    }
    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(SORT_FILE, mode);
  } catch {
    // Preference write should never block the jobs screen.
  }
}
