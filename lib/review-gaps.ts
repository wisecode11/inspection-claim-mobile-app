import { CAPTURE_STEPS, PhotoItem, StepId } from '@/lib/capture-steps';
import type { InspectionData } from '@/lib/inspection-types';

export type StepGap = {
  stepId: StepId;
  title: string;
  message: string;
};

export function photosForStep(photos: PhotoItem[], stepId: StepId) {
  return photos.filter((photo) => photo.stepId === stepId);
}

export function findInspectionGaps(data: InspectionData): StepGap[] {
  const gaps: StepGap[] = [];

  for (const step of CAPTURE_STEPS) {
    const count = photosForStep(data.photos, step.id).length;

    if (step.suggestedGaps?.length) {
      const missing = step.suggestedGaps.filter(
        (slot) => !data.photos.some((photo) => photo.stepId === step.id && photo.label === slot)
      );
      if (missing.length) {
        gaps.push({
          stepId: step.id,
          title: step.title,
          message: `Missing recommended slots: ${missing.join(', ')}`,
        });
      }
      continue;
    }

    if (step.id === 'build-notes') {
      const hasFields = Object.values(data.buildNotes.fields).some((value) => value.trim());
      const hasText = Object.values(data.buildNotes.texts).some((value) => value.trim());
      if (!hasFields && !hasText && count === 0) {
        gaps.push({
          stepId: step.id,
          title: step.title,
          message: 'No build notes or supporting photos yet',
        });
      }
      continue;
    }

    if (count === 0 && !data.completedSteps.includes(step.id)) {
      gaps.push({
        stepId: step.id,
        title: step.title,
        message: 'No photos captured yet',
      });
    }
  }

  return gaps;
}
