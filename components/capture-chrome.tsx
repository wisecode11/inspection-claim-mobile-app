import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CAPTURE_STEPS, StepId } from '@/lib/capture-steps';
import { useInspection } from '@/context/inspection-context';
import { captureHref } from '@/lib/routes';

type Props = {
  stepId: StepId;
  onSkip?: () => void;
};

export function CaptureChrome({ stepId, onSkip }: Props) {
  const router = useRouter();
  const { data, markStepComplete } = useInspection();
  const step = CAPTURE_STEPS.find((entry) => entry.id === stepId);
  if (!step) return null;

  const goSkip = () => {
    markStepComplete(stepId);
    onSkip?.();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.brandBar}>
        <Text style={styles.brand}>CLAIMCAPTURE</Text>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressRow}>
        {CAPTURE_STEPS.map((entry) => {
          const done = data.completedSteps.includes(entry.id);
          const active = entry.id === stepId;
          return (
            <Pressable
              key={entry.id}
              style={[styles.chip, active && styles.chipActive, done && !active && styles.chipDone]}
              onPress={() => router.push(captureHref(entry.id))}
            >
              <Text style={[styles.chipText, (active || done) && styles.chipTextOn]}>
                {done && !active ? '✓' : entry.number}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#163A4A',
    paddingBottom: 12,
  },
  brandBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  brand: { color: '#E17035', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  brandSub: { color: '#9BB4BD', fontSize: 11, fontWeight: '600' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  sideBtn: { minWidth: 52, padding: 4 },
  center: { alignItems: 'center', flex: 1 },
  headerAction: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  skip: { color: '#FFB089', textAlign: 'right' },
  headerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  headerStep: { color: '#B7C9D0', fontSize: 12, marginTop: 2 },
  progressRow: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  chipActive: { backgroundColor: '#E17035' },
  chipDone: { backgroundColor: '#2F6B57' },
  chipText: { color: '#C9D9DF', fontSize: 12, fontWeight: '800' },
  chipTextOn: { color: '#FFFFFF' },
});
