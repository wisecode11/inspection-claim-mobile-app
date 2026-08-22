import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CAPTURE_STEPS, StepId } from '@/lib/capture-steps';
import { useInspection } from '@/context/inspection-context';
import { captureHref } from '@/lib/routes';

type Props = {
  stepId: StepId;
  onSkip?: () => void;
};

const PROGRESS_PAD = 16;
const PROGRESS_GAP = 6;
const CHIP_MIN = 26;
const CHIP_MAX = 34;

export function CaptureChrome({ stepId, onSkip }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, markStepComplete } = useInspection();
  const step = CAPTURE_STEPS.find((entry) => entry.id === stepId);
  if (!step) return null;

  const stepCount = CAPTURE_STEPS.length;
  const available = width - PROGRESS_PAD * 2 - PROGRESS_GAP * (stepCount - 1);
  const chipSize = Math.max(CHIP_MIN, Math.min(CHIP_MAX, Math.floor(available / stepCount)));

  const goSkip = () => {
    markStepComplete(stepId);
    onSkip?.();
  };

  const goHome = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.brandBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to Home"
          hitSlop={8}
          onPress={goHome}
          style={({ pressed }) => [styles.homeBtn, pressed && styles.pressed]}
        >
          <Text style={styles.homeText}>Home</Text>
        </Pressable>
        <Text style={styles.brandSub}>Field Capture</Text>
      </View>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.sideBtn}>
          <Text style={styles.headerAction}>Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.headerTitle}>
            Step {step.number} of {CAPTURE_STEPS.length}
          </Text>
          <Text style={styles.headerStep} numberOfLines={1}>
            {step.title}
          </Text>
        </View>
        <Pressable onPress={goSkip} hitSlop={8} style={styles.sideBtn}>
          <Text style={[styles.headerAction, styles.skip]}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        {CAPTURE_STEPS.map((entry) => {
          const done = data.completedSteps.includes(entry.id);
          const active = entry.id === stepId;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`Step ${entry.number}${active ? ', current' : done ? ', completed' : ''}`}
              hitSlop={4}
              style={[
                styles.chip,
                { width: chipSize, height: chipSize, borderRadius: chipSize / 2 },
                active && styles.chipActive,
                done && !active && styles.chipDone,
              ]}
              onPress={() => router.replace(captureHref(entry.id))}
            >
              <Text
                style={[
                  styles.chipText,
                  { fontSize: chipSize >= 30 ? 12 : 11 },
                  (active || done) && styles.chipTextOn,
                ]}
              >
                {done && !active ? '✓' : entry.number}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#163A4A',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 14,
  },
  brandBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  homeBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  homeText: {
    color: '#FFB089',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pressed: { opacity: 0.75 },
  brandSub: { color: '#D2E0E5', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  sideBtn: { minWidth: 56, paddingVertical: 6, paddingHorizontal: 4 },
  center: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  headerAction: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  skip: { color: '#FFB089', textAlign: 'right', fontWeight: '800' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  headerStep: { color: '#E8F0F3', fontSize: 13, fontWeight: '600', marginTop: 3 },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: PROGRESS_PAD,
    paddingTop: 14,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#E17035' },
  chipDone: { backgroundColor: '#2F6B57' },
  chipText: { color: '#EEF4F6', fontWeight: '800' },
  chipTextOn: { color: '#FFFFFF' },
});
