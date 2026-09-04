import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useInspection } from '@/context/inspection-context';
import { CAPTURE_STEPS, prevStepId, StepId } from '@/lib/capture-steps';

const HeroBg = Brand.accent;
const HeroMuted = '#8FAEB8';
const CapturedMint = '#64D2B1';
const BackBtnBg = 'rgba(255,255,255,0.12)';

type Props = {
  stepId: StepId;
  onSkip?: () => void;
};

function slotMatches(photoLabel: string, slot: string) {
  return photoLabel === slot || photoLabel.startsWith(`${slot} (`);
}

export function CaptureChrome({ stepId, onSkip }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, markStepComplete, update } = useInspection();
  const step = CAPTURE_STEPS.find((entry) => entry.id === stepId);
  if (!step) return null;

  const stepPhotos = data.photos.filter((photo) => photo.stepId === stepId);
  let captured = 0;
  let total = 0;

  if (step.mode === 'slots' && step.slots?.length) {
    total = step.slots.length;
    captured = step.slots.filter((slot) =>
      stepPhotos.some((photo) => slotMatches(photo.label, slot)),
    ).length;
  } else if ((step.mode === 'components' || step.mode === 'metal') && step.components?.length) {
    total = step.components.length;
    captured = step.components.filter((component) =>
      stepPhotos.some(
        (photo) =>
          photo.component === component ||
          photo.label === component ||
          photo.label.startsWith(`${component} (`),
      ),
    ).length;
  } else {
    captured = stepPhotos.length;
    total = 0;
  }

  const goToSetup = () => {
    // Pop back to the existing Setup screen instead of stacking another one.
    // replace() left [setup, setup] and made the header back bounce once.
    if (router.canDismiss()) {
      router.dismissTo('/setup');
      return;
    }
    router.replace('/setup');
  };

  const goPreviousStep = () => {
    const prev = prevStepId(stepId);
    if (prev === 'setup') {
      goToSetup();
      return;
    }
    update({ currentStepId: prev });
  };

  const goSetup = () => {
    goToSetup();
  };

  const goSkip = () => {
    markStepComplete(stepId);
    onSkip?.();
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.navRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous step"
          hitSlop={8}
          onPress={goPreviousStep}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons color="#FFFFFF" name="chevron-back" size={20} />
        </Pressable>

        <Text style={styles.stepLabel}>
          STEP {step.number} OF {CAPTURE_STEPS.length}
        </Text>

        <View style={styles.navActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to setup"
            hitSlop={8}
            onPress={goSetup}
            style={({ pressed }) => [styles.setupBtn, pressed && styles.pressed]}
          >
            <Text style={styles.setupText}>Setup</Text>
          </Pressable>
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
      </View>

      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>
        </View>

        <View style={styles.capturedBox}>
          <Text style={styles.capturedCount}>
            {captured}
            {total > 0 ? <Text style={styles.capturedTotal}>/{total}</Text> : null}
          </Text>
          <Text style={styles.capturedLabel}>CAPTURED</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: HeroBg,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    alignItems: 'center',
    backgroundColor: BackBtnBg,
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepLabel: {
    color: HeroMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  navActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  setupBtn: {
    justifyContent: 'center',
    paddingVertical: 8,
  },
  setupText: {
    color: HeroMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  skipBtn: {
    justifyContent: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  heroRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  subtitle: {
    color: HeroMuted,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 8,
  },
  capturedBox: {
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  capturedCount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  capturedTotal: {
    color: HeroMuted,
    fontSize: 18,
    fontWeight: '500',
  },
  capturedLabel: {
    color: CapturedMint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  pressed: { opacity: 0.7 },
});
