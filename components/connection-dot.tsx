import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useOnlineStatus } from '@/hooks/use-online-status';

const ONLINE_COLOR = '#32CD32';
const OFFLINE_COLOR = '#FF4D4F';
const ONLINE_HALO = 'rgba(181,203,211,0.18)';
const OFFLINE_HALO = 'rgba(255,77,79,0.28)';

/**
 * Small status dot: soft green blink while the backend is reachable,
 * fast red blink when the device is offline or the server can't be reached.
 * `active` pauses the animation (screen unfocused / reduce motion).
 */
export function ConnectionDot({ active, onlineColor = ONLINE_COLOR }: { active: boolean; onlineColor?: string }) {
  const online = useOnlineStatus();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }

    opacity.value = online
      ? // Calm ≈ 2s cycle while connected.
        withRepeat(
          withSequence(
            withTiming(1, { duration: 200 }),
            withTiming(0.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 200 }),
          ),
          -1,
          false,
        )
      : // Urgent ≈ 0.8s cycle while offline.
        withRepeat(
          withSequence(
            withTiming(0.15, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );

    return () => {
      cancelAnimation(opacity);
    };
  }, [active, online, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View
      accessibilityLabel={online ? 'Online' : 'Offline'}
      accessible
      style={[styles.halo, { backgroundColor: online ? ONLINE_HALO : OFFLINE_HALO }]}
    >
      <Animated.View
        style={[styles.dot, { backgroundColor: online ? onlineColor : OFFLINE_COLOR }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    alignItems: 'center',
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 14,
  },
  dot: {
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
    width: 6,
  },
});
