import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { CaptureChrome } from '@/components/capture-chrome';
import { Screen, ui } from '@/components/inspection-ui';
import { StepCapture } from '@/components/step-capture';
import { useInspection } from '@/context/inspection-context';
import { getStepById, nextStepId, prevStepId, StepId } from '@/lib/capture-steps';
import { captureHref } from '@/lib/routes';

export default function CaptureStepScreen() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step: string }>();
  const { markStepComplete, update } = useInspection();
  const step = getStepById(stepParam);

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
    router.replace(captureHref(next));
  }, [markStepComplete, router, step, update]);

  const goPrev = useCallback(() => {
    if (!step) return;
    const prev = prevStepId(step.id as StepId);
    if (prev === 'setup') {
      router.replace('/setup');
      return;
    }
    update({ currentStepId: prev });
    router.replace(captureHref(prev));
  }, [router, step, update]);

  const swipeToNext = useCallback(() => {
    if (!step) return;
    const next = nextStepId(step.id as StepId);
    if (next === 'review') {
      update({ currentStepId: step.id });
      router.replace('/review');
      return;
    }
    update({ currentStepId: next });
    router.replace(captureHref(next));
  }, [router, step, update]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      if (event.translationX <= -64 || event.velocityX <= -500) {
        runOnJS(swipeToNext)();
        return;
      }
      if (event.translationX >= 64 || event.velocityX >= 500) {
        runOnJS(goPrev)();
      }
    });

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
      <GestureDetector gesture={swipeGesture}>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
            <StepCapture step={step} onContinue={goNext} />
          </ScrollView>
        </View>
      </GestureDetector>
    </Screen>
  );
}
