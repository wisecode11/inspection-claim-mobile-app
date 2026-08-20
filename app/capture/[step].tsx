import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { CaptureChrome } from '@/components/capture-chrome';
import { StepCapture } from '@/components/step-capture';
import { ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';
import { getStepById, nextStepId, StepId } from '@/lib/capture-steps';
import { captureHref } from '@/lib/routes';

export default function CaptureStepScreen() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step: string }>();
  const { markStepComplete, update } = useInspection();
  const step = getStepById(stepParam);

  if (!step) {
    return (
      <SafeAreaView style={ui.screen}>
        <View style={ui.content}>
          <Text style={ui.title}>Unknown step</Text>
          <Text style={ui.subtitle}>Go back and continue the inspection sequence.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const goNext = () => {
    markStepComplete(step.id);
    const next = nextStepId(step.id as StepId);
    if (next === 'review') {
      update({ currentStepId: step.id });
      router.push('/review');
      return;
    }
    update({ currentStepId: next });
    router.push(captureHref(next));
  };

  return (
    <SafeAreaView style={ui.screen}>
      <CaptureChrome
        stepId={step.id}
        onSkip={goNext}
      />
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <StepCapture step={step} onContinue={goNext} />
      </ScrollView>
    </SafeAreaView>
  );
}
