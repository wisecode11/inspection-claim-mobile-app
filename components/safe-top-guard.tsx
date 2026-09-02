import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeTopGuardProps = {
  color: string;
};

/** Opaque overlay that keeps scrolled content from showing under the status bar. */
export function SafeTopGuard({ color }: SafeTopGuardProps) {
  const insets = useSafeAreaInsets();

  if (insets.top <= 0) {
    return null;
  }

  return <View pointerEvents="none" style={[styles.guard, { backgroundColor: color, height: insets.top }]} />;
}

const styles = StyleSheet.create({
  guard: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
});
