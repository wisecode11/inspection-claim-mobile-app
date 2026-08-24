import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useInspection } from '@/context/inspection-context';
import { getStepById, StepId } from '@/lib/capture-steps';
import { captureHref } from '@/lib/routes';

/**
 * Legacy / deep-link entry: /capture/:step
 * Sets currentStepId once, then lands on the stable /capture screen (no per-step remounts).
 */
export default function CaptureStepRedirect() {
  const { step: stepParam } = useLocalSearchParams<{ step: string }>();
  const { update } = useInspection();
  const step = getStepById(stepParam);

  useEffect(() => {
    if (step) {
      update({ currentStepId: step.id as StepId });
    }
  }, [step, update]);

  return <Redirect href={captureHref()} />;
}
