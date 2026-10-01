export function isInProgressStatus(status: string) {
  const key = status.toLowerCase();
  // Rejected packages go back to the inspector, so they count as work in progress.
  return key.includes('progress') || key === 'rejected';
}

export function isCompletedStatus(status: string) {
  const key = status.toLowerCase();
  return key.includes('complete') || key.includes('submit');
}

export function isActionableStatus(status: string) {
  const key = status.toLowerCase();
  return (
    isInProgressStatus(key) ||
    key === 'assigned' ||
    key === 'scheduled' ||
    key === 'reopened'
  );
}

export function filterInProgressJobs<T extends { status: string }>(jobs: T[]) {
  return jobs.filter((job) => isInProgressStatus(job.status));
}
