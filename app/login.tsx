import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

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
            <View style={styles.logo}>
              <Text style={styles.logoMark}>⌂</Text>
            </View>
            <Text style={styles.brand}>ROOFCHECK</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue field inspections</Text>

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
                placeholderTextColor="#8A9AA3"
                style={styles.input}
                value={email}
              />
              <Text style={styles.label}>Password</Text>
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
                placeholderTextColor="#8A9AA3"
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
    backgroundColor: Brand.background,
    flex: 1,
  },
  backdropTop: {
    backgroundColor: Brand.ink,
    height: '38%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backdropBottom: {
    backgroundColor: Brand.background,
    bottom: 0,
    height: '62%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  flex: { flex: 1 },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  card: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: 'rgba(22, 58, 74, 0.06)',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 8,
    maxWidth: 420,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#0F2430',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    width: '100%',
  },
  logo: {
    alignItems: 'center',
    backgroundColor: Brand.ink,
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    marginBottom: 16,
    width: 64,
  },
  logoMark: {
    color: Brand.surface,
    fontSize: 34,
    fontWeight: '700',
    marginTop: -4,
  },
  brand: {
    color: Brand.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  title: {
    color: Brand.ink,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: Brand.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    marginTop: 28,
    width: '100%',
  },
  label: {
    color: '#314B57',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F7FAFB',
    borderColor: Brand.border,
    borderRadius: 12,
    borderWidth: 1,
    color: Brand.ink,
    fontSize: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  error: {
    color: Brand.danger,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: -4,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 14,
    marginTop: 6,
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.75 },
  buttonText: {
    color: Brand.surface,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardFooter: {
    color: Brand.soft,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 22,
    textAlign: 'center',
  },
});
