import { Href } from 'expo-router';

import type { StepId } from '@/lib/capture-steps';

export function captureHref(stepId: StepId | string): Href {
  return `/capture/${stepId}` as Href;
}
