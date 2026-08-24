import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { CaptureChrome } from '@/components/capture-chrome';
import { Screen, ui } from '@/components/inspection-ui';
import { StepCapture } from '@/components/step-capture';
import { useInspection } from '@/context/inspection-context';
import { getStepById, nextStepId, StepId } from '@/lib/capture-steps';

/**
 * Stable capture screen. Step changes update `currentStepId` only (no route remount).
 * Swipe gestures were removed — they raced with Fabric layout updates and caused
 * "Unable to find viewState for tag" crashes on Android.
 */
export default function CaptureScreen() {
  const router = useRouter();
  const { data, markStepComplete, update } = useInspection();
  const step = getStepById(data.currentStepId);

  const goNext = useCallback(() => {
    if (!step) return;
    markStepComplete(step.id);
    const next = nextStepId(step.id as StepId);
    if (next === 'review') {
      update({ currentStepId: step.id });
      router.replace('/review');
      return;
    }
    update({ currentStepId: next });
  }, [markStepComplete, router, step, update]);

  if (!step) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={ui.content}>
          <Text style={ui.title}>Unknown step</Text>
          <Text style={ui.subtitle}>Go back and continue the inspection sequence.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <CaptureChrome stepId={step.id} onSkip={goNext} />
      <View style={{ flex: 1 }} collapsable={false}>
        <ScrollView
          contentContainerStyle={ui.content}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
        >
          <StepCapture key={step.id} step={step} onContinue={goNext} />
        </ScrollView>
      </View>
    </Screen>
  );
}
