import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useInspection } from '@/context/inspection-context';
import { CAPTURE_STEPS, StepId } from '@/lib/capture-steps';

type Props = {
  stepId: StepId;
  onSkip?: () => void;
};

export function CaptureChrome({ stepId, onSkip }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, markStepComplete, update } = useInspection();
  const step = CAPTURE_STEPS.find((entry) => entry.id === stepId);
  if (!step) return null;

  const goSkip = () => {
    markStepComplete(stepId);
    onSkip?.();
  };

  const selectStep = (id: StepId) => {
    if (id === stepId) return;
    requestAnimationFrame(() => {
      update({ currentStepId: id });
    });
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.navRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons color={Brand.ink} name="chevron-back" size={24} />
        </Pressable>

        <Animated.Text
          key={stepId}
          entering={FadeIn.duration(220)}
          style={styles.navTitle}
          numberOfLines={1}
        >
          Step {step.number} · {step.title}
        </Animated.Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this step"
          hitSlop={8}
          onPress={goSkip}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        {CAPTURE_STEPS.map((entry) => {
          const done = data.completedSteps.includes(entry.id);
          const active = entry.id === stepId;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`${entry.title}${active ? ', current' : done ? ', completed' : ''}`}
              onPress={() => selectStep(entry.id)}
              style={styles.segmentHit}
            >
              <View
                style={[
                  styles.segment,
                  done && !active && styles.segmentDone,
                  active && styles.segmentActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Brand.background,
    borderBottomColor: Brand.border,
    borderBottomWidth: 1,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 6,
  },
  backBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  navTitle: {
    color: Brand.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  skipBtn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 40,
    paddingVertical: 8,
  },
  skipText: {
    color: Brand.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: { opacity: 0.65 },
  progressTrack: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 14,
  },
  segmentHit: {
    flex: 1,
    paddingVertical: 6,
  },
  segment: {
    backgroundColor: '#DDE4E8',
    borderRadius: 2,
    height: 4,
  },
  segmentDone: {
    backgroundColor: Brand.ink,
  },
  segmentActive: {
    backgroundColor: Brand.accent,
  },
});
