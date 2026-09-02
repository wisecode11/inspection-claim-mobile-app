import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { SafeTopGuard } from '@/components/safe-top-guard';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const HeroPrimary = Brand.accent;
const HeroTextMuted = '#8FAEB8';
const BodyBg = Brand.sheetBg;
const TextPrimary = '#1A1A1A';
const TextSecondary = '#6B7280';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
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
            <View style={styles.heroOrbLarge} pointerEvents="none" />
            <View style={styles.heroOrbSmall} pointerEvents="none" />

            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Text style={styles.logoText}>R</Text>
              </View>
              <Text style={styles.brandName}>RoofCheck</Text>
            </View>

            <View style={styles.heroLogoWrap}>
              <BrandLogo size={72} variant="primary" />
            </View>

            <Text style={styles.heroEyebrow}>INSPECTOR PORTAL</Text>
            <Text style={styles.heroTitle}>{'Welcome\nback'}</Text>
            <Text style={styles.heroBody}>
              {'Sign in to continue field\ninspections and capture evidence.'}
            </Text>
          </View>

          <View style={styles.bodySheet}>
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
  heroOrbLarge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 999,
    height: 220,
    position: 'absolute',
    right: -60,
    top: -20,
    width: 220,
  },
  heroOrbSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 999,
    bottom: 40,
    height: 120,
    position: 'absolute',
    right: 16,
    width: 120,
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
  heroLogoWrap: {
    alignItems: 'center',
    marginBottom: 20,
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
    paddingBottom: 32,
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
