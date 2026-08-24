import type { Href } from 'expo-router';

import type { StepId } from '@/lib/capture-steps';

/**
 * Stable capture route. The active step lives on inspection context (`currentStepId`),
 * so switching steps does not remount the screen.
 */
export function captureHref(_stepId?: StepId | string): Href {
  return '/capture' as Href;
}
