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
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const DarkBg = '#2C2E30';
const PageBg = '#F4F7F8';
const LoginAccent = '#A6400D';
const TextPrimary = '#1C1C1C';
const TextMuted = '#6B7B85';
const LabelColor = '#3D4F57';
const InputBorder = '#D8E0E4';
const Placeholder = '#A0ADB4';

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
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.backdropTop} />
      <View style={styles.backdropBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.hero}>
              <BrandLogo size={64} style={styles.logo} variant="primary" />
              <Text style={styles.brand}>ROOFCHECK</Text>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue field inspections</Text>
            </View>

            <View style={styles.form}>
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
                placeholderTextColor={Placeholder}
                style={styles.input}
                value={email}
              />

              <View style={styles.passwordLabelRow}>
                <Text style={styles.labelInline}>Password</Text>
                <Pressable disabled={loading} hitSlop={8} onPress={onForgotPassword}>
                  <Text style={styles.forgotLink}>Forgot Password?</Text>
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
                placeholderTextColor={Placeholder}
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
                  <Text style={styles.buttonText}>Log In</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.cardFooter}>Field inspections made simple</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: PageBg,
    flex: 1,
  },
  backdropTop: {
    backgroundColor: DarkBg,
    height: '50%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backdropBottom: {
    backgroundColor: PageBg,
    bottom: 0,
    height: '50%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  flex: { flex: 1 },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    alignSelf: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 40,
    elevation: 10,
    maxWidth: 400,
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
  },
  logo: {
    marginBottom: 14,
  },
  brand: {
    color: LoginAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  title: {
    color: TextPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: TextMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    marginTop: 28,
    width: '100%',
  },
  label: {
    color: LabelColor,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  labelInline: {
    color: LabelColor,
    fontSize: 13,
    fontWeight: '700',
  },
  passwordLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  forgotLink: {
    color: LoginAccent,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: InputBorder,
    borderRadius: 10,
    borderWidth: 1,
    color: TextPrimary,
    fontSize: 15,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  error: {
    color: Brand.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: -6,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: LoginAccent,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 50,
    paddingVertical: 14,
  },
  buttonPressed: { opacity: 0.92 },
  buttonDisabled: { opacity: 0.75 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardFooter: {
    color: TextMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 22,
    textAlign: 'center',
  },
});
