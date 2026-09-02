export function isInProgressStatus(status: string) {
  const key = status.toLowerCase();
  return key.includes('progress');
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
