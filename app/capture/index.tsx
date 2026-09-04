import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { CaptureChrome } from '@/components/capture-chrome';
import { Screen } from '@/components/inspection-ui';
import { StepCapture } from '@/components/step-capture';
import { Brand } from '@/constants/theme';
import { useInspection } from '@/context/inspection-context';
import { CAPTURE_STEPS, getStepById, nextStepId, StepId } from '@/lib/capture-steps';

/**
 * Stable capture screen. Step changes update `currentStepId` only (no route remount).
 * Swipe gestures were removed — they raced with Fabric layout updates and caused
 * "Unable to find viewState for tag" crashes on Android.
 */
export default function CaptureScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { data, markStepComplete, update } = useInspection();
  const step = getStepById(data.currentStepId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step?.id]);

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
        <View style={styles.content}>
          <Text style={styles.errorTitle}>Unknown step</Text>
          <Text style={styles.errorText}>Go back and continue the inspection sequence.</Text>
        </View>
      </Screen>
    );
  }

  const nextLabel = step.number === CAPTURE_STEPS.length ? 'Continue to review' : 'Next step';

  return (
    <Screen edges={['bottom']} style={styles.screen}>
      <CaptureChrome stepId={step.id} onSkip={goNext} />
      <View style={styles.body} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={step.id}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(140)}
            style={styles.stepWrap}
          >
            <StepCapture step={step} />
          </Animated.View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
          onPress={goNext}
        >
          <Text style={styles.nextButtonText}>{nextLabel}</Text>
          <Ionicons color={Brand.surface} name="arrow-forward" size={18} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.background, flex: 1 },
  body: { flex: 1 },
  stepWrap: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  content: { padding: 20 },
  errorTitle: { color: Brand.ink, fontSize: 22, fontWeight: '700' },
  errorText: { color: Brand.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  footer: {
    backgroundColor: Brand.surface,
    borderTopColor: Brand.border,
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadius,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  nextButtonPressed: { opacity: 0.92 },
  nextButtonText: { color: Brand.surface, fontSize: 16, fontWeight: '700' },
});
