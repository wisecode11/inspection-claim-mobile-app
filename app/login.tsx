import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
      router.replace('/jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logo}>
            <Text style={styles.logoMark}>⌂</Text>
          </View>
          <Text style={styles.title}>RoofCheck</Text>
          <Text style={styles.subtitle}>Inspection workspace</Text>

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
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Text style={styles.footer}>RoofCheck • Field inspections made simple</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F8' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: {
    alignItems: 'center',
    backgroundColor: '#163A4A',
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    marginBottom: 18,
    width: 64,
  },
  logoMark: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginTop: -5 },
  title: { color: '#163A4A', fontSize: 32, fontWeight: '800' },
  subtitle: { color: '#60737D', fontSize: 16, marginTop: 6 },
  form: { marginTop: 46 },
  label: { color: '#314B57', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E0E4',
    borderRadius: 12,
    borderWidth: 1,
    color: '#163A4A',
    fontSize: 16,
    marginBottom: 20,
    padding: 15,
  },
  error: { color: '#C0392B', fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: -8 },
  button: { alignItems: 'center', backgroundColor: '#E17035', borderRadius: 12, marginTop: 8, padding: 16 },
  buttonDisabled: { opacity: 0.75 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  footer: { color: '#84949C', fontSize: 12, paddingBottom: 26, textAlign: 'center' },
});
