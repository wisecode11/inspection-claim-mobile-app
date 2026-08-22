import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

type AnimatedSplashProps = {
  /** When true, run exit fade before unmounting via parent. */
  exiting?: boolean;
};

export function AnimatedSplash({ exiting = false }: AnimatedSplashProps) {
  const logoScale = useSharedValue(0.72);
  const logoGlow = useSharedValue(0);
  const barProgress = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    logoGlow.value = withDelay(
      280,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    barProgress.value = withDelay(
      420,
      withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      ),
    );
  }, [barProgress, logoGlow, logoScale]);

  useEffect(() => {
    if (exiting) {
      screenOpacity.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) });
    }
  }, [exiting, screenOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    shadowOpacity: interpolate(logoGlow.value, [0, 1], [0.12, 0.32]),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logoGlow.value, [0, 1], [0.15, 0.45]),
    transform: [{ scale: interpolate(logoGlow.value, [0, 1], [1, 1.12]) }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: interpolate(barProgress.value, [0, 1], [22, 120]),
  }));

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  return (
    <Animated.View
      pointerEvents={exiting ? 'none' : 'auto'}
      style={[styles.screen, screenStyle]}
    >
      <View style={styles.atmosphere}>
        <View style={[styles.blob, styles.blobTeal]} />
        <View style={[styles.blob, styles.blobOrange]} />
      </View>

      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View entering={ZoomIn.duration(520).springify()} style={[styles.logo, logoStyle]}>
            <Text style={styles.logoMark}>⌂</Text>
          </Animated.View>
        </View>

        <Animated.Text entering={FadeInDown.delay(180).duration(480)} style={styles.title}>
          RoofCheck
        </Animated.Text>
        <Animated.Text entering={FadeInUp.delay(320).duration(480)} style={styles.subtitle}>
          Inspection workspace
        </Animated.Text>

        <Animated.View entering={FadeIn.delay(520).duration(400)} style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barStyle]} />
        </Animated.View>
      </View>

      <Animated.Text entering={FadeIn.delay(700).duration(450)} style={styles.footer}>
        Field inspections made simple
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brand.background,
    justifyContent: 'center',
    zIndex: 100,
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.14,
  },
  blobTeal: {
    backgroundColor: Brand.ink,
    height: 280,
    width: 280,
    top: -80,
    right: -60,
  },
  blobOrange: {
    backgroundColor: Brand.accent,
    bottom: -40,
    height: 220,
    left: -70,
    width: 220,
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    alignItems: 'center',
    height: 108,
    justifyContent: 'center',
    marginBottom: 22,
    width: 108,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderColor: Brand.accent,
    borderRadius: 28,
    borderWidth: 2,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: Brand.ink,
    borderRadius: 22,
    elevation: 8,
    height: 88,
    justifyContent: 'center',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    width: 88,
  },
  logoMark: {
    color: Brand.surface,
    fontSize: 48,
    fontWeight: '700',
    marginTop: -6,
  },
  title: {
    color: Brand.ink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: Brand.muted,
    fontSize: 16,
    marginTop: 8,
  },
  barTrack: {
    alignSelf: 'center',
    backgroundColor: '#E2E9EC',
    borderRadius: 999,
    height: 4,
    marginTop: 36,
    overflow: 'hidden',
    width: 120,
  },
  barFill: {
    backgroundColor: Brand.accent,
    borderRadius: 999,
    height: '100%',
  },
  footer: {
    bottom: 42,
    color: Brand.soft,
    fontSize: 13,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
});
