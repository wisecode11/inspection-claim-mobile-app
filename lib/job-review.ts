import * as FileSystem from 'expo-file-system/legacy';

import { resolveApiUrl, type InspectionJob, type JobReport } from '@/lib/api';

/**
 * Where a submitted inspection stands with the admin.
 * - pending: sent, waiting for the admin (report submitted / under review)
 * - changes_requested: admin sent it back without rejecting (report back to draft)
 * - rejected: admin rejected it; the inspector must fix and resend
 * - approved: admin approved it; the job is complete
 */
export type ReviewState = 'pending' | 'changes_requested' | 'rejected' | 'approved';

/** Job statuses that mean the inspector has already sent the package. */
const PENDING_JOB_STATUSES = new Set(['submitted', 'reviewed', 'review_required', 'report_generated']);

export function latestReport(job: InspectionJob): JobReport | null {
  if (!job.reports?.length) return null;
  return [...job.reports].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
}

/**
 * Works from the list payload (status only) or the detail payload (status + reports).
 * Returns null for jobs the inspector still has to work on.
 */
export function reviewStateForJob(job: InspectionJob): ReviewState | null {
  const status = job.status.toLowerCase();
  const report = latestReport(job);

  if (status === 'rejected' || report?.status === 'rejected') return 'rejected';
  if (status === 'completed' || report?.status === 'approved') return 'approved';
  if (PENDING_JOB_STATUSES.has(status)) {
    if (report?.status === 'draft' && report.changesRequested) return 'changes_requested';
    return 'pending';
  }
  return null;
}

/** Statuses that should open the submission status screen instead of the capture flow. */
export function opensStatusScreen(status: string): boolean {
  const key = status.toLowerCase();
  return key === 'completed' || PENDING_JOB_STATUSES.has(key);
}

export function reviewReason(job: InspectionJob): string {
  const report = latestReport(job);
  return (report?.rejectionReason || report?.changesRequested || '').trim();
}

export function formatReviewDate(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Downloads the PDF the inspector submitted (served by a tokenized URL, no auth header)
 * into the cache so it can be previewed, opened or shared. Cached per report version.
 */
export async function downloadSubmittedPdf(report: JobReport): Promise<string> {
  if (!report.pdfUrl) {
    throw new Error('No PDF is attached to this report.');
  }
  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error('Storage is not available on this device.');
  }

  const target = `${dir}submitted-report-${report.id}-v${report.version ?? 1}.pdf`;
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists && existing.size) return target;

  const result = await FileSystem.downloadAsync(resolveApiUrl(report.pdfUrl), target);
  if (result.status !== 200) {
    await FileSystem.deleteAsync(target, { idempotent: true });
    throw new Error('Could not download the PDF. Please try again.');
  }
  return result.uri;
}
