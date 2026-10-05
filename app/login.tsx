import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ClipboardCheck, Hammer, HardHat, Ruler, Timer } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { requireOptionalNativeModule } from 'expo';

import type * as HeroTitle3DModule from '@/components/hero-title-3d';
import type { HeroTools3D as HeroTools3DComponent } from '@/components/hero-tools-3d';
import { SafeTopGuard } from '@/components/safe-top-guard';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useSplashDone } from '@/context/splash-context';

// expo-gl throws at import time when its native module is missing (e.g. a dev
// build made before expo-gl was added), so only load the 3D hero when it exists.
const GL_AVAILABLE = Boolean(requireOptionalNativeModule('ExponentGLObjectManager'));
/* eslint-disable @typescript-eslint/no-require-imports */
const HeroTools3D: typeof HeroTools3DComponent | null = GL_AVAILABLE
  ? require('@/components/hero-tools-3d').HeroTools3D
  : null;
const heroTitle3d: typeof HeroTitle3DModule | null = GL_AVAILABLE
  ? require('@/components/hero-title-3d')
  : null;
/* eslint-enable @typescript-eslint/no-require-imports */
const HeroTitle3D = heroTitle3d?.HeroTitle3D ?? null;

const HERO_TITLE_LINES = ['Welcome', 'back'];

const HeroPrimary = Brand.accent;
const HeroTextMuted = '#8FAEB8';
const BodyBg = Brand.sheetBg;
const TextPrimary = '#1A1A1A';
const TextSecondary = '#6B7280';
const ORBIT_MS = 28000;

const ORBIT_TOOLS = [
  { Icon: Ruler, size: 32, strokeWidth: 1.6, left: 42, top: -8 },
  { Icon: Timer, size: 28, strokeWidth: 1.7, left: 92, top: 42 },
  { Icon: HardHat, size: 26, strokeWidth: 1.8, left: 42, top: 92 },
  { Icon: Hammer, size: 30, strokeWidth: 1.7, left: -8, top: 42 },
];

// Intro: clipboard pops in, tools slide out from behind it one by one, then the orbit starts.
const TOOL_CENTER_SLOT = 42;
const INTRO_CLIPBOARD_MS = 520;
const INTRO_TOOLS_AT_MS = 420;
const INTRO_TOOL_STAGGER_MS = 120;
const INTRO_TOOL_MS = 650;
const INTRO_DONE_MS =
  INTRO_TOOLS_AT_MS + (ORBIT_TOOLS.length - 1) * INTRO_TOOL_STAGGER_MS + INTRO_TOOL_MS;

// Beam rides the same circle as `toolRing` (124 box, ring radius 50).
const BEAM_MS = 3600;
const BEAM_CENTER = 62;
const BEAM_RADIUS = 50;
const BEAM_COLOR = '#BFF3FF';
const BEAM_TAIL_DEG = 75;
const BEAM_SEGMENTS = 15;

function ringPoint(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: BEAM_CENTER + BEAM_RADIUS * Math.sin(rad),
    y: BEAM_CENTER - BEAM_RADIUS * Math.cos(rad),
  };
}

// Tail trails counter-clockwise behind the head (at 12 o'clock), fading out.
const BEAM_TAIL = Array.from({ length: BEAM_SEGMENTS }, (_, i) => {
  const step = BEAM_TAIL_DEG / BEAM_SEGMENTS;
  const from = ringPoint(-BEAM_TAIL_DEG + i * step);
  const to = ringPoint(-BEAM_TAIL_DEG + (i + 1) * step + 0.5);
  const t = (i + 1) / BEAM_SEGMENTS;
  return {
    d: `M ${from.x} ${from.y} A ${BEAM_RADIUS} ${BEAM_RADIUS} 0 0 1 ${to.x} ${to.y}`,
    opacity: t * t * 0.9,
    width: 1 + t * 1.6,
  };
});

function OrbitBeam({ start }: { start: boolean }) {
  const spin = useSharedValue(0);
  const visible = useSharedValue(0);

  useEffect(() => {
    if (!start) return;
    visible.value = withDelay(INTRO_DONE_MS, withTiming(1, { duration: 500 }));
    spin.value = withDelay(
      INTRO_DONE_MS,
      withRepeat(withTiming(360, { duration: BEAM_MS, easing: Easing.linear }), -1, false),
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(visible);
    };
  }, [start, spin, visible]);

  const spinStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const head = ringPoint(0);

  return (
    <Animated.View style={[styles.toolOrbit, spinStyle]}>
      <Svg height={124} width={124}>
        <Defs>
          <RadialGradient id="beamGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={BEAM_COLOR} stopOpacity={0.85} />
            <Stop offset="0.45" stopColor={BEAM_COLOR} stopOpacity={0.3} />
            <Stop offset="1" stopColor={BEAM_COLOR} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {BEAM_TAIL.map((segment, index) => (
          <Path
            key={index}
            d={segment.d}
            fill="none"
            stroke={BEAM_COLOR}
            strokeLinecap="round"
            strokeOpacity={segment.opacity}
            strokeWidth={segment.width}
          />
        ))}
        <Circle cx={head.x} cy={head.y} fill="url(#beamGlow)" r={9} />
        <Circle cx={head.x} cy={head.y} fill="#FFFFFF" r={2.2} />
      </Svg>
    </Animated.View>
  );
}

type OrbitTool = (typeof ORBIT_TOOLS)[number];

/** Starts hidden behind the clipboard, then pops out to its slot on the ring. */
function OrbitToolSpot({
  tool,
  index,
  rotation,
  start,
}: {
  tool: OrbitTool;
  index: number;
  rotation: SharedValue<number>;
  start: boolean;
}) {
  const spread = useSharedValue(0);
  const { Icon, size, strokeWidth, left, top } = tool;
  const offsetX = TOOL_CENTER_SLOT - left;
  const offsetY = TOOL_CENTER_SLOT - top;

  useEffect(() => {
    if (!start) return;
    spread.value = withDelay(
      INTRO_TOOLS_AT_MS + index * INTRO_TOOL_STAGGER_MS,
      withTiming(1, { duration: INTRO_TOOL_MS, easing: Easing.out(Easing.back(1.5)) }),
    );
    return () => cancelAnimation(spread);
  }, [start, spread, index]);

  const spotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, spread.value * 2),
    transform: [
      { translateX: offsetX * (1 - spread.value) },
      { translateY: offsetY * (1 - spread.value) },
      { scale: 0.5 + 0.5 * spread.value },
      { rotate: `${-rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.toolSpot, { left, top }, spotStyle]}>
      <Icon color="#FFFFFF" size={size} strokeWidth={strokeWidth} />
    </Animated.View>
  );
}

function ToolOrbit() {
  const start = useSplashDone();
  const rotation = useSharedValue(0);
  const clipboard = useSharedValue(0);

  useEffect(() => {
    if (!start) return;
    clipboard.value = withTiming(1, {
      duration: INTRO_CLIPBOARD_MS,
      easing: Easing.out(Easing.back(1.8)),
    });
    // Orbit only begins once every tool has settled on the ring.
    rotation.value = withDelay(
      INTRO_DONE_MS,
      withRepeat(withTiming(360, { duration: ORBIT_MS, easing: Easing.linear }), -1, false),
    );
    return () => {
      cancelAnimation(clipboard);
      cancelAnimation(rotation);
    };
  }, [start, clipboard, rotation]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, clipboard.value),
    transform: [{ scale: 0.6 + 0.4 * clipboard.value }],
  }));
  const clipboardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, clipboard.value * 1.5),
    transform: [{ scale: 0.3 + 0.7 * clipboard.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.toolIcons}>
      <Animated.View style={[styles.toolRing, ringStyle]} />
      <OrbitBeam start={start} />
      <Animated.View style={[styles.toolOrbit, orbitStyle]}>
        {ORBIT_TOOLS.map((tool, index) => (
          <OrbitToolSpot
            key={tool.Icon.displayName ?? String(tool.size)}
            index={index}
            rotation={rotation}
            start={start}
            tool={tool}
          />
        ))}
      </Animated.View>
      <Animated.View style={[styles.toolCenter, clipboardStyle]}>
        <ClipboardCheck color="#FFFFFF" size={36} strokeWidth={1.6} />
      </Animated.View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hero3dFailed, setHero3dFailed] = useState(false);
  const [title3dFailed, setTitle3dFailed] = useState(false);
  const [titleWidth, setTitleWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const splashDone = useSplashDone();

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const onSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Email and password are required');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = () => {
    Alert.alert('Forgot password', 'Contact your administrator to reset your password.');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <StatusBar style="light" />
      <SafeTopGuard color={HeroPrimary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          bounces
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View style={styles.heroSection}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Text style={styles.logoText}>R</Text>
              </View>
              <Text style={styles.brandName}>RoofCheck</Text>
            </View>

            <View style={styles.heroTitleRow}>
              <View
                onLayout={(event) => setTitleWidth(Math.round(event.nativeEvent.layout.width))}
                style={styles.heroTitleCopy}
              >
                <Text style={styles.heroEyebrow}>INSPECTOR PORTAL</Text>
                {heroTitle3d && HeroTitle3D && !title3dFailed ? (
                  <View
                    style={[
                      styles.heroTitle3d,
                      { height: heroTitle3d.heroTitle3DHeight(HERO_TITLE_LINES.length) },
                    ]}
                  >
                    {titleWidth > 0 ? (
                      <HeroTitle3D
                        // Re-create the GL scene if the available width changes (e.g. rotation).
                        key={titleWidth}
                        animate={!reduceMotion}
                        lines={HERO_TITLE_LINES}
                        onError={() => setTitle3dFailed(true)}
                        start={splashDone}
                        width={titleWidth}
                      />
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.heroTitle}>{HERO_TITLE_LINES.join('\n')}</Text>
                )}
              </View>
              {hero3dFailed || !HeroTools3D ? (
                <ToolOrbit />
              ) : (
                <HeroTools3D
                  animate={!reduceMotion}
                  onError={() => setHero3dFailed(true)}
                  size={140}
                  start={splashDone}
                />
              )}
            </View>
            <Text style={styles.heroBody}>
              {'Sign in to continue field\ninspections and capture evidence.'}
            </Text>
          </View>

          <View style={[styles.bodySheet, { paddingBottom: 32 + insets.bottom }]}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Sign in</Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
                keyboardType="email-address"
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) setError('');
                }}
                placeholder="inspector@roofcheck.com"
                placeholderTextColor={Brand.soft}
                style={styles.input}
                value={email}
              />

              <View style={styles.passwordLabelRow}>
                <Text style={styles.labelInline}>Password</Text>
                <Pressable disabled={loading} hitSlop={8} onPress={onForgotPassword}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </Pressable>
              </View>
              <TextInput
                autoComplete="password"
                editable={!loading}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError('');
                }}
                onSubmitEditing={() => {
                  void onSubmit();
                }}
                placeholder="Enter your password"
                placeholderTextColor={Brand.soft}
                secureTextEntry
                style={styles.input}
                value={password}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                disabled={loading}
                onPress={() => {
                  void onSubmit();
                }}
                style={({ pressed }) => [
                  styles.button,
                  loading && styles.buttonDisabled,
                  pressed && !loading && styles.buttonPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Log in</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Text style={styles.footer}>Field inspections made simple</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: HeroPrimary,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    backgroundColor: HeroPrimary,
    overflow: 'visible',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    position: 'relative',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroTitleCopy: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  heroTitle3d: {
    // Text baseline in the 3D view already includes its own top padding.
    marginTop: 8,
  },
  toolIcons: {
    height: 124,
    width: 124,
  },
  toolRing: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 100,
    left: 12,
    position: 'absolute',
    top: 12,
    width: 100,
  },
  toolOrbit: {
    height: 124,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 124,
  },
  toolSpot: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    width: 40,
  },
  toolCenter: {
    alignItems: 'center',
    // Opaque disc so tools waiting at the center stay hidden behind the clipboard.
    backgroundColor: HeroPrimary,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    left: 42,
    position: 'absolute',
    top: 42,
    width: 40,
  },
  heroEyebrow: {
    color: HeroTextMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginTop: 14,
  },
  heroBody: {
    color: HeroTextMuted,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 14,
    maxWidth: '92%',
  },
  bodySheet: {
    backgroundColor: BodyBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flexGrow: 1,
    minHeight: 360,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBE6DF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  formTitle: {
    color: TextPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 18,
  },
  label: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  labelInline: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  passwordLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 4,
  },
  forgotLink: {
    color: HeroPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: Brand.border,
    borderRadius: Brand.buttonRadius,
    borderWidth: 1,
    color: TextPrimary,
    fontSize: 15,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  error: {
    color: Brand.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: -4,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    borderRadius: Brand.buttonRadiusLg,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 48,
    paddingVertical: 13,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    color: TextSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 24,
    textAlign: 'center',
  },
});
