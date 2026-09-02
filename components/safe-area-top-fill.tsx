import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeAreaTopFillProps = {
  color: string;
};

/** Opaque strip that keeps scrolled content from showing through the status bar. */
export function SafeAreaTopFill({ color }: SafeAreaTopFillProps) {
  const insets = useSafeAreaInsets();

  if (insets.top <= 0) {
    return null;
  }

  return <View pointerEvents="none" style={[styles.fill, { backgroundColor: color, height: insets.top }]} />;
}

const styles = StyleSheet.create({
  fill: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
});
