import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
      <View style={styles.screen}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{this.state.error.message}</Text>
        <Pressable onPress={() => this.setState({ error: null })} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F4F7F8',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: { color: '#163A4A', fontSize: 24, fontWeight: '800' },
  message: { color: '#C0392B', fontSize: 15, lineHeight: 22, marginTop: 12 },
  button: {
    alignItems: 'center',
    backgroundColor: '#E17035',
    borderRadius: 12,
    marginTop: 24,
    padding: 16,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
