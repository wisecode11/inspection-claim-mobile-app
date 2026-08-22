import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';

type ErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{this.state.error.message}</Text>
        <Pressable onPress={() => this.setState({ error: null })} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Brand.background,
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: { color: Brand.ink, fontSize: 24, fontWeight: '800' },
  message: { color: Brand.danger, fontSize: 15, lineHeight: 22, marginTop: 12 },
  button: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 12,
    marginTop: 24,
    padding: 16,
  },
  buttonText: { color: Brand.surface, fontSize: 16, fontWeight: '800' },
});
