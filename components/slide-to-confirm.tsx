import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Brand } from '@/constants/theme';

const THUMB_WIDTH = 58;
const TRACK_PADDING = 5;
const TRACK_HEIGHT = 68;
const THUMB_INSET = 3;
const INNER_HEIGHT = TRACK_HEIGHT - TRACK_PADDING * 2;
const THUMB_HEIGHT = INNER_HEIGHT - THUMB_INSET * 2;
const THUMB_TOP = TRACK_PADDING + THUMB_INSET;
const SHIMMER_LINE_WIDTH = 260;
const COMPLETE_RATIO = 0.45;
const HALO_EXTRA_X = 22;
const HALO_EXTRA_Y = 14;
const BLOOM_WIDTH = 96;
const SUBTITLE_TONE = '#8FAEB8';
const CHEVRON_MUTED = '#B5CBD3';

type SlideToConfirmProps = {
  title?: string;
  subtitle?: string;
  onComplete: () => void;
  disabled?: boolean;
};

export function SlideToConfirm({
  title = 'Slide to start',
  subtitle = '10-step inspection - step 1 of 10',
  onComplete,
  disabled = false,
}: SlideToConfirmProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const maxX = useSharedValue(0);
  const completed = useSharedValue(false);
  const thumbScale = useSharedValue(1);
  const haloPulse = useSharedValue(0);
  const shimmerX = useSharedValue(-SHIMMER_LINE_WIDTH);
  const shimmerOpacity = useSharedValue(1);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setTrackWidth(width);
    maxX.value = Math.max(0, width - THUMB_WIDTH - TRACK_PADDING * 2);
  }, [maxX]);

  const startShimmer = useCallback(() => {
    if (trackWidth <= 0) return;
    cancelAnimation(shimmerX);
    shimmerX.value = -SHIMMER_LINE_WIDTH;
    shimmerOpacity.value = 1;
    shimmerX.value = withRepeat(
      withTiming(trackWidth + SHIMMER_LINE_WIDTH, {
        duration: 2800,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [shimmerOpacity, shimmerX, trackWidth]);

  const resetSlider = useCallback(() => {
    cancelAnimation(shimmerX);
    cancelAnimation(haloPulse);
    translateX.value = 0;
    startX.value = 0;
    completed.value = false;
    thumbScale.value = 1;
    haloPulse.value = 0;
    shimmerX.value = -SHIMMER_LINE_WIDTH;
    shimmerOpacity.value = disabled ? 0 : 1;
    if (!disabled && trackWidth > 0) {
      startShimmer();
      haloPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [
    completed,
    disabled,
    haloPulse,
    shimmerOpacity,
    shimmerX,
    startShimmer,
    startX,
    thumbScale,
    trackWidth,
    translateX,
  ]);

  useFocusEffect(
    useCallback(() => {
      resetSlider();
    }, [resetSlider]),
  );

  useEffect(() => {
    if (disabled) {
      cancelAnimation(shimmerX);
      cancelAnimation(haloPulse);
      shimmerX.value = -SHIMMER_LINE_WIDTH;
      shimmerOpacity.value = 0;
      translateX.value = 0;
      completed.value = false;
      thumbScale.value = 1;
      haloPulse.value = 0;
      return;
    }
    startShimmer();
    haloPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [
    disabled,
    haloPulse,
    shimmerOpacity,
    shimmerX,
    startShimmer,
    thumbScale,
    translateX,
    completed,
  ]);

  const finish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    onComplete();
  }, [onComplete]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      cancelAnimation(shimmerX);
      cancelAnimation(haloPulse);
      shimmerOpacity.value = withTiming(0, { duration: 180 });
      haloPulse.value = withTiming(1, { duration: 160 });
      startX.value = translateX.value;
      thumbScale.value = withSpring(1.04, { damping: 14, stiffness: 280 });
    })
    .onUpdate((event) => {
      if (completed.value || maxX.value <= 0) return;
      const next = startX.value + event.translationX;
      translateX.value = Math.min(Math.max(0, next), maxX.value);
    })
    .onEnd(() => {
      if (completed.value || maxX.value <= 0) return;

      if (translateX.value >= maxX.value * COMPLETE_RATIO) {
        completed.value = true;
        thumbScale.value = withSequence(
          withSpring(1.08, { damping: 10, stiffness: 320 }),
          withSpring(1, { damping: 14, stiffness: 260 }),
        );
        translateX.value = withSpring(maxX.value, { damping: 20, stiffness: 240 });
        runOnJS(finish)();
      } else {
        thumbScale.value = withSpring(1, { damping: 16, stiffness: 260 });
        translateX.value = withSpring(0, { damping: 20, stiffness: 240 });
        shimmerOpacity.value = withTiming(1, { duration: 220 });
        haloPulse.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
        runOnJS(startShimmer)();
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: thumbScale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => {
    const dragGlow = interpolate(
      translateX.value,
      [0, maxX.value * 0.15, maxX.value],
      [0.35, 0.85, 1],
      Extrapolation.CLAMP,
    );
    const pulse = interpolate(haloPulse.value, [0, 1], [0.55, 1]);
    return {
      opacity: dragGlow * pulse,
      transform: [
        { translateX: translateX.value },
        { scale: interpolate(thumbScale.value, [1, 1.08], [1, 1.12]) },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, maxX.value * 0.55],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  /** Soft light wash behind the knob — reads as illumination, not a solid fill. */
  const liftStyle = useAnimatedStyle(() => ({
    width: Math.max(0, translateX.value + THUMB_WIDTH * 0.55),
    opacity: interpolate(
      translateX.value,
      [0, 12, maxX.value],
      [0, 0.7, 1],
      Extrapolation.CLAMP,
    ),
  }));

  /** Brighter bloom that stays under/around the knob edge. */
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 8, maxX.value],
      [0, 0.9, 1],
      Extrapolation.CLAMP,
    ),
    transform: [{ translateX: Math.max(0, translateX.value - BLOOM_WIDTH * 0.35) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={onTrackLayout}
    >
      <Animated.View pointerEvents="none" style={[styles.liftWash, liftStyle]}>
        {trackWidth > 0 ? (
          <Svg height={THUMB_HEIGHT} width="100%">
            <Defs>
              <LinearGradient id="trackLift" x1="0" x2="1" y1="0" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity="0.14" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.22" />
              </LinearGradient>
            </Defs>
            <Rect fill="url(#trackLift)" height="100%" width="100%" rx={Brand.buttonRadius} />
          </Svg>
        ) : null}
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.knobBloom, bloomStyle]}>
        <Svg height={THUMB_HEIGHT} width={BLOOM_WIDTH}>
          <Defs>
            <LinearGradient id="knobBloom" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.1" />
              <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity="0.28" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#knobBloom)" height="100%" width="100%" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={styles.shimmerClip}>
        <Animated.View style={[styles.shimmerLine, shimmerStyle]}>
          <Svg height={THUMB_HEIGHT} width={SHIMMER_LINE_WIDTH}>
            <Defs>
              <LinearGradient id="slideShimmer" x1="0" x2="1" y1="0" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.32" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.46" stopColor="#FFFFFF" stopOpacity="0.14" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.32" />
                <Stop offset="0.54" stopColor="#FFFFFF" stopOpacity="0.14" />
                <Stop offset="0.68" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect fill="url(#slideShimmer)" height="100%" width="100%" />
          </Svg>
        </Animated.View>
      </View>

      <Animated.View pointerEvents="none" style={[styles.labelWrap, labelStyle]}>
        <Animated.Text numberOfLines={1} style={styles.title}>{title}</Animated.Text>
        <Animated.Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Animated.Text>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.haloWrap, haloStyle]}>
        <View style={styles.haloOuter} />
        <View style={styles.haloMid} />
        <View style={styles.haloInner} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <View style={styles.chevronRow}>
            <Ionicons color={Brand.accent} name="chevron-forward" size={19} />
            <Ionicons
              color={CHEVRON_MUTED}
              name="chevron-forward"
              size={19}
              style={styles.thumbChevronSecond}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadiusLg,
    height: TRACK_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  trackDisabled: {
    opacity: 0.5,
  },
  liftWash: {
    borderRadius: Brand.buttonRadius,
    bottom: THUMB_TOP,
    left: TRACK_PADDING,
    overflow: 'hidden',
    position: 'absolute',
    top: THUMB_TOP,
    zIndex: 0,
  },
  knobBloom: {
    bottom: THUMB_TOP,
    height: THUMB_HEIGHT,
    left: TRACK_PADDING,
    position: 'absolute',
    top: THUMB_TOP,
    width: BLOOM_WIDTH,
    zIndex: 1,
  },
  shimmerClip: {
    bottom: THUMB_TOP,
    left: TRACK_PADDING,
    overflow: 'hidden',
    position: 'absolute',
    right: TRACK_PADDING,
    top: THUMB_TOP,
    zIndex: 1,
  },
  shimmerLine: {
    height: THUMB_HEIGHT,
    width: SHIMMER_LINE_WIDTH,
  },
  labelWrap: {
    bottom: THUMB_TOP,
    justifyContent: 'center',
    left: TRACK_PADDING + THUMB_WIDTH + 8,
    position: 'absolute',
    right: TRACK_PADDING + 4,
    top: THUMB_TOP,
    zIndex: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },
  subtitle: {
    color: SUBTITLE_TONE,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 2,
  },
  haloWrap: {
    alignItems: 'center',
    height: THUMB_HEIGHT + HALO_EXTRA_Y * 2,
    justifyContent: 'center',
    left: TRACK_PADDING - HALO_EXTRA_X,
    position: 'absolute',
    top: THUMB_TOP - HALO_EXTRA_Y,
    width: THUMB_WIDTH + HALO_EXTRA_X * 2,
    zIndex: 2,
  },
  haloOuter: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Brand.buttonRadius + 10,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  haloMid: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Brand.buttonRadius + 6,
    bottom: 4,
    left: 6,
    position: 'absolute',
    right: 6,
    top: 4,
  },
  haloInner: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Brand.buttonRadius + 3,
    bottom: 8,
    left: 12,
    position: 'absolute',
    right: 12,
    top: 8,
  },
  thumb: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Brand.buttonRadius,
    elevation: 4,
    height: THUMB_HEIGHT,
    justifyContent: 'center',
    left: TRACK_PADDING,
    position: 'absolute',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    top: THUMB_TOP,
    width: THUMB_WIDTH,
    zIndex: 3,
  },
  chevronRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  thumbChevronSecond: {
    marginLeft: -10,
  },
});
