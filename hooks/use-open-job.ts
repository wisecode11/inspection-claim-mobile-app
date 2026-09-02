import { useRouter } from 'expo-router';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import {
  acceptJob,
  InspectionJob,
  jobAddressText,
  jobCoordinates,
  jobCustomerName,
  jobDateLabel,
  jobDateOfLoss,
} from '@/lib/api';

type SetJobs = Dispatch<SetStateAction<InspectionJob[]>>;

export function useOpenJob(setJobs?: SetJobs) {
  const router = useRouter();
  const { token } = useAuth();
  const { resetForJob } = useInspection();
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);

  const openJob = useCallback(
    async (job: InspectionJob) => {
      const customer = jobCustomerName(job);
      const address = jobAddressText(job);
      const date = jobDateLabel(job);

      setOpeningJobId(String(job.id));
      let nextStatus = job.status;

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
      }

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
      });
      setOpeningJobId(null);
      router.push('/property');
    },
    [resetForJob, router, setJobs, token],
  );

  return { openJob, openingJobId };
}
