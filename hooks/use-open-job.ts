import { useRouter } from 'expo-router';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import {
  acceptJob,
  fetchJob,
  InspectionJob,
  jobAddressText,
  jobCoordinates,
  jobCustomerName,
  jobDateLabel,
  jobDateOfLoss,
} from '@/lib/api';
import type { InspectionData } from '@/lib/inspection-types';
import { latestReport, opensStatusScreen, reviewReason, reviewStateForJob } from '@/lib/job-review';

type SetJobs = Dispatch<SetStateAction<InspectionJob[]>>;

type OpenJobOptions = {
  /** Open the capture flow even for a submitted job (e.g. admin requested changes). */
  skipStatusScreen?: boolean;
  /** Job detail already fetched by the caller (includes reports). */
  detail?: InspectionJob;
};

export function useOpenJob(setJobs?: SetJobs) {
  const router = useRouter();
  const { token } = useAuth();
  const { resetForJob } = useInspection();
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);

  const openJob = useCallback(
    async (job: InspectionJob, options: OpenJobOptions = {}) => {
      // Sent packages are read-only until the admin acts: show where they stand instead.
      if (!options.skipStatusScreen && opensStatusScreen(job.status)) {
        router.push({ pathname: '/job-status', params: { jobId: String(job.id) } });
        return;
      }

      const customer = jobCustomerName(job);
      const address = jobAddressText(job);
      const date = jobDateLabel(job);

      setOpeningJobId(String(job.id));
      let nextStatus = job.status;
      let detail = options.detail;

      if (token) {
        try {
          const key = job.status.toLowerCase();
          if (key === 'assigned' || key === 'reopened') {
            const started = await acceptJob(token, job.id);
            nextStatus = started.status;
            setJobs?.((current) =>
              current.map((entry) =>
                entry.id === job.id ? { ...entry, status: started.status } : entry,
              ),
            );
          }
        } catch {
          // Offline / already started — continue with local draft.
        }

        // The list payload has no reports, so fetch the admin's reason for a sent-back job.
        if (!detail && job.status.toLowerCase() === 'rejected') {
          detail = await fetchJob(token, job.id).catch(() => undefined);
        }
      }

      const state = reviewStateForJob(detail ?? job);
      const review: InspectionData['review'] =
        state === 'rejected' || state === 'changes_requested'
          ? {
              state,
              reason: detail ? reviewReason(detail) : '',
              reviewedAt: (detail && latestReport(detail)?.reviewedAt) || null,
            }
          : null;

      const coords = jobCoordinates(job);
      resetForJob({
        jobId: job.id,
        customer,
        address: job.geocode?.formattedAddress?.trim() || address,
        date,
        jobStatus: nextStatus,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        locationConfirmed: Boolean(job.geocode?.confirmed),
        geocodeError: job.geocode?.error || '',
        dateOfLoss: jobDateOfLoss(job),
        claimNumber: job.claim?.claimNumber || '',
        policyNumber: job.claim?.policyNumber || '',
        phone: job.customer?.phone || '',
        email: job.customer?.email || '',
        review,
      });
      setOpeningJobId(null);
      router.push('/property');
    },
    [resetForJob, router, setJobs, token],
  );

  return { openJob, openingJobId };
}
