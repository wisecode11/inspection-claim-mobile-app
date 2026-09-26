import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type TypewriterLine = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Per-line typing speed; overrides the shared `typeMs`. */
  typeMs?: number;
};

type Props = {
  lines: TypewriterLine[];
  /** Change this (e.g. after login) to replay the intro animation. */
  playKey: string;
  reduceMotion?: boolean;
  /** Default ms per character for lines that don't set their own `typeMs`. */
  typeMs?: number;
  /** Pause between finishing one line and starting the next. */
  lineGapMs?: number;
  /** Faster typing for the last line (user request). */
  lastLineTypeMs?: number;
};

const playedKeys = new Set<string>();

/**
 * Login greeting: short shake, then typewriter lines.
 * Last line types faster. Replays only when `playKey` changes (new login).
 */
export function TypewriterGreeting({
  lines,
  playKey,
  reduceMotion = false,
  typeMs = 28,
  lineGapMs = 220,
  lastLineTypeMs = 12,
}: Props) {
  const lineTexts = useMemo(() => lines.map((line) => line.text), [lines]);
  const linesSignature = lineTexts.join('\0');
  const alreadyPlayed = playedKeys.has(playKey);

  const [visible, setVisible] = useState<string[]>(() =>
    reduceMotion || alreadyPlayed ? lineTexts : lineTexts.map(() => ''),
  );
  const [activeLine, setActiveLine] = useState(() =>
    reduceMotion || alreadyPlayed ? lineTexts.length : 0,
  );
  const [done, setDone] = useState(() => reduceMotion || alreadyPlayed);
  const shakeX = useSharedValue(0);
  const cancelled = useRef(false);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    cancelled.current = false;

    if (reduceMotion) {
      setVisible(lineTexts);
      setActiveLine(lineTexts.length);
      setDone(true);
      playedKeys.add(playKey);
      return;
    }

    if (playedKeys.has(playKey)) {
      setVisible(lineTexts);
      setActiveLine(lineTexts.length);
      setDone(true);
      return;
    }

    setVisible(lineTexts.map(() => ''));
    setActiveLine(0);
    setDone(false);

    const tick = { duration: 42, easing: Easing.linear };
    shakeX.value = withSequence(
      withTiming(-7, tick),
      withTiming(7, tick),
      withTiming(-5, tick),
      withTiming(5, tick),
      withTiming(-3, tick),
      withTiming(3, tick),
      withTiming(0, { duration: 50, easing: Easing.out(Easing.quad) }),
    );

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lineIndex = 0;
    let charIndex = 0;

    const clear = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

    const finish = () => {
      if (cancelled.current) return;
      setVisible(lineTexts);
      setActiveLine(lineTexts.length);
      setDone(true);
      playedKeys.add(playKey);
    };

    const step = () => {
      if (cancelled.current) return;
      if (lineIndex >= lineTexts.length) {
        finish();
        return;
      }

      const full = lineTexts[lineIndex];
      const isLast = lineIndex === lineTexts.length - 1;
      const speed = lines[lineIndex]?.typeMs ?? (isLast ? lastLineTypeMs : typeMs);

      if (charIndex === 0) {
        setActiveLine(lineIndex);
      }

      if (charIndex <= full.length) {
        const slice = full.slice(0, charIndex);
        setVisible((prev) => {
          const next = [...prev];
          next[lineIndex] = slice;
          return next;
        });
        charIndex += 1;
        timeoutId = setTimeout(step, speed);
        return;
      }

      lineIndex += 1;
      charIndex = 0;
      timeoutId = setTimeout(step, lineGapMs);
    };

    timeoutId = setTimeout(step, 180);

    return () => {
      cancelled.current = true;
      clear();
    };
  }, [lastLineTypeMs, lineGapMs, lines, linesSignature, lineTexts, playKey, reduceMotion, shakeX, typeMs]);

  return (
    <Animated.View style={[styles.wrap, shakeStyle]}>
      {lines.map((line, index) => (
        <Text key={`${playKey}-${index}`} style={line.style}>
          {visible[index] ?? ''}
          {!done && activeLine === index ? (
            <Text style={styles.caret}>|</Text>
          ) : null}
        </Text>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  caret: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '400',
  },
});
