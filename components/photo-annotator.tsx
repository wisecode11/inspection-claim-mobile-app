import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

type Tool = 'circle' | 'arrow' | 'draw' | 'text';

type Point = { x: number; y: number };

type Annotation =
  | { id: string; kind: 'circle'; x: number; y: number; width: number; height: number }
  | { id: string; kind: 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: 'draw'; points: Point[] }
  | { id: string; kind: 'text'; x: number; y: number; text: string };

type Props = {
  visible: boolean;
  uri: string;
  onClose: () => void;
  /** Called with a NEW file uri — never overwrites the source image. */
  onSaved: (uri: string) => void;
};

const STROKE = '#E53935';
const STROKE_WIDTH = 3;

function normalizeBox(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function arrowHead(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 14;
  return [
    { x: x2, y: y2 },
    { x: x2 - size * Math.cos(angle - Math.PI / 6), y: y2 - size * Math.sin(angle - Math.PI / 6) },
    { x: x2 - size * Math.cos(angle + Math.PI / 6), y: y2 - size * Math.sin(angle + Math.PI / 6) },
  ];
}

function pointsToPath(points: Point[]) {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
}

function ShapeLayer({ shapes, draft }: { shapes: Annotation[]; draft: Annotation | null }) {
  const all = draft ? [...shapes, draft] : shapes;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {all.map((shape) => {
        if (shape.kind === 'circle') {
          if (shape.width < 2 || shape.height < 2) return null;
          return (
            <Circle
              key={shape.id}
              cx={shape.x + shape.width / 2}
              cy={shape.y + shape.height / 2}
              r={Math.max(shape.width, shape.height) / 2}
              stroke={STROKE}
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />
          );
        }
        if (shape.kind === 'arrow') {
          const head = arrowHead(shape.x1, shape.y1, shape.x2, shape.y2);
          return (
            <G key={shape.id}>
              <Line
                x1={shape.x1}
                y1={shape.y1}
                x2={shape.x2}
                y2={shape.y2}
                stroke={STROKE}
                strokeWidth={STROKE_WIDTH}
              />
              <Polygon points={head.map((p) => `${p.x},${p.y}`).join(' ')} fill={STROKE} />
            </G>
          );
        }
        if (shape.kind === 'draw') {
          if (shape.points.length < 2) return null;
          return (
            <Path
              key={shape.id}
              d={pointsToPath(shape.points)}
              stroke={STROKE}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        return (
          <SvgText
            key={shape.id}
            x={shape.x}
            y={shape.y}
            fill={STROKE}
            fontSize={18}
            fontWeight="700"
          >
            {shape.text}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const TOOLS: { id: Tool; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'circle', label: 'Circle', icon: 'ellipse-outline' },
  { id: 'arrow', label: 'Arrow', icon: 'arrow-forward-outline' },
  { id: 'draw', label: 'Draw', icon: 'brush-outline' },
  { id: 'text', label: 'Text', icon: 'text-outline' },
];

export function PhotoAnnotator({ visible, uri, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const captureViewRef = useRef<View>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [shapes, setShapes] = useState<Annotation[]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const startRef = useRef({ x: 0, y: 0 });

  const resetState = () => {
    setTool(null);
    setShapes([]);
    setRedoStack([]);
    setDraft(null);
    setTextDraft(null);
    setSaving(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const commitShape = (shape: Annotation) => {
    setShapes((current) => [...current, shape]);
    setRedoStack([]);
    setDraft(null);
  };

  const beginDraw = (x: number, y: number) => {
    if (!tool || tool === 'text') return;
    startRef.current = { x, y };
    if (tool === 'circle') {
      setDraft({ id: 'draft', kind: 'circle', x, y, width: 0, height: 0 });
    } else if (tool === 'arrow') {
      setDraft({ id: 'draft', kind: 'arrow', x1: x, y1: y, x2: x, y2: y });
    } else if (tool === 'draw') {
      setDraft({ id: 'draft', kind: 'draw', points: [{ x, y }] });
    }
  };

  const moveDraw = (x: number, y: number) => {
    if (!tool || tool === 'text') return;
    if (tool === 'circle') {
      const box = normalizeBox(startRef.current.x, startRef.current.y, x, y);
      setDraft((current) =>
        current?.kind === 'circle' ? { ...current, ...box } : current
      );
    } else if (tool === 'arrow') {
      setDraft((current) =>
        current?.kind === 'arrow' ? { ...current, x2: x, y2: y } : current
      );
    } else if (tool === 'draw') {
      setDraft((current) =>
        current?.kind === 'draw'
          ? { ...current, points: [...current.points, { x, y }] }
          : current
      );
    }
  };

  const endDraw = (x: number, y: number) => {
    if (!tool || tool === 'text') return;
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (tool === 'circle') {
      const box = normalizeBox(startRef.current.x, startRef.current.y, x, y);
      setDraft(null);
      if (box.width < 8 && box.height < 8) return;
      commitShape({ id, kind: 'circle', ...box });
      return;
    }

    if (tool === 'arrow') {
      setDraft(null);
      const dx = Math.abs(x - startRef.current.x);
      const dy = Math.abs(y - startRef.current.y);
      if (dx < 8 && dy < 8) return;
      commitShape({
        id,
        kind: 'arrow',
        x1: startRef.current.x,
        y1: startRef.current.y,
        x2: x,
        y2: y,
      });
      return;
    }

    if (tool === 'draw') {
      setDraft((current) => {
        if (current?.kind !== 'draw') return null;
        const points = current.points;
        if (points.length >= 2) {
          // Defer commit so we don't update sibling state inside this setter.
          queueMicrotask(() => {
            commitShape({ id, kind: 'draw', points });
          });
        }
        return null;
      });
    }
  };

  const placeText = (x: number, y: number) => {
    if (tool !== 'text') return;
    setTextDraft({ x, y, value: '' });
  };

  const confirmText = () => {
    if (!textDraft) return;
    const value = textDraft.value.trim();
    if (value) {
      commitShape({
        id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'text',
        x: textDraft.x,
        y: textDraft.y,
        text: value,
      });
    }
    setTextDraft(null);
  };

  const panGesture = Gesture.Pan()
    .enabled(Boolean(tool) && tool !== 'text')
    .minDistance(0)
    .onBegin((event) => {
      runOnJS(beginDraw)(event.x, event.y);
    })
    .onUpdate((event) => {
      runOnJS(moveDraw)(event.x, event.y);
    })
    .onEnd((event) => {
      runOnJS(endDraw)(event.x, event.y);
    });

  const tapGesture = Gesture.Tap()
    .enabled(tool === 'text')
    .onEnd((event) => {
      runOnJS(placeText)(event.x, event.y);
    });

  const composed = Gesture.Simultaneous(panGesture, tapGesture);

  const onUndo = () => {
    setShapes((current) => {
      if (!current.length) return current;
      const next = current.slice(0, -1);
      const removed = current[current.length - 1];
      setRedoStack((stack) => [...stack, removed]);
      return next;
    });
    setDraft(null);
  };

  const onRedo = () => {
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const next = stack.slice(0, -1);
      const restored = stack[stack.length - 1];
      setShapes((current) => [...current, restored]);
      return next;
    });
  };

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  };

  const onSave = async () => {
    if (!captureViewRef.current) return;
    if (shapes.length === 0) {
      Alert.alert('Nothing to save', 'Add a circle, arrow, drawing, or text first.');
      return;
    }

    setSaving(true);
    try {
      // Always write a NEW file — original photo URI is never overwritten.
      const captured = await captureRef(captureViewRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });
      const dest = `${FileSystem.documentDirectory}annotated_copy_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: captured, to: dest });
      onSaved(dest);
      resetState();
    } catch (error) {
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'Could not save the annotated copy.'
      );
    } finally {
      setSaving(false);
    }
  };

  const toolHint = (() => {
    if (!tool) return 'Pick a tool, mark damage, then Save copy. Original stays unchanged.';
    if (tool === 'text') return 'Tap the photo to place red text.';
    if (tool === 'draw') return 'Drag freely to draw on the damage area.';
    if (tool === 'arrow') return 'Drag to place a red arrow.';
    return 'Drag to draw a red circle on the damage.';
  })();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Pressable hitSlop={8} onPress={handleClose} disabled={saving}>
              <Text style={styles.headerAction}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Annotate copy</Text>
            <Pressable hitSlop={8} onPress={() => void onSave()} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#E17035" />
              ) : (
                <Text style={[styles.headerAction, styles.save]}>Save copy</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>{toolHint}</Text>

          <View style={styles.canvasWrap}>
            <GestureDetector gesture={composed}>
              <View
                ref={captureViewRef}
                collapsable={false}
                onLayout={onCanvasLayout}
                style={styles.canvas}
              >
                <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                {canvasSize.width > 0 ? <ShapeLayer shapes={shapes} draft={draft} /> : null}
              </View>
            </GestureDetector>
          </View>

          <View style={styles.toolbar}>
            <View style={styles.pencilRow}>
              <View style={styles.pencilIcon}>
                <Ionicons color="#163A4A" name="pencil" size={20} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolScroll}>
                {TOOLS.map((entry) => {
                  const active = tool === entry.id;
                  return (
                    <Pressable
                      key={entry.id}
                      style={[styles.toolBtn, active && styles.toolBtnOn]}
                      onPress={() => setTool((current) => (current === entry.id ? null : entry.id))}
                    >
                      <Ionicons color={active ? '#FFFFFF' : '#D2E0E5'} name={entry.icon} size={18} />
                      <Text style={[styles.toolLabel, active && styles.toolLabelOn]}>{entry.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[styles.secondaryBtn, !shapes.length && styles.secondaryDisabled]}
                onPress={onUndo}
                disabled={!shapes.length || saving}
              >
                <Ionicons color="#FFFFFF" name="arrow-undo-outline" size={16} />
                <Text style={styles.secondaryText}>Undo</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, !redoStack.length && styles.secondaryDisabled]}
                onPress={onRedo}
                disabled={!redoStack.length || saving}
              >
                <Ionicons color="#FFFFFF" name="arrow-redo-outline" size={16} />
                <Text style={styles.secondaryText}>Redo</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Modal visible={Boolean(textDraft)} transparent animationType="fade">
          <View style={styles.textModalRoot}>
            <View style={styles.textCard}>
              <Text style={styles.textCardTitle}>Annotation text</Text>
              <TextInput
                autoFocus
                value={textDraft?.value ?? ''}
                onChangeText={(value) =>
                  setTextDraft((current) => (current ? { ...current, value } : current))
                }
                placeholder="e.g. Hail dent"
                placeholderTextColor="#8A9AA3"
                style={styles.textInput}
                onSubmitEditing={confirmText}
              />
              <View style={styles.textActions}>
                <Pressable
                  style={styles.textCancel}
                  onPress={() => setTextDraft(null)}
                >
                  <Text style={styles.textCancelLabel}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.textConfirm} onPress={confirmText}>
                  <Text style={styles.textConfirmLabel}>Add</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0F2430',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerAction: {
    color: '#D2E0E5',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 72,
  },
  save: {
    color: '#FFB089',
    fontWeight: '800',
    textAlign: 'right',
  },
  hint: {
    color: '#9BB4BD',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingBottom: 10,
    textAlign: 'center',
  },
  canvasWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  canvas: {
    backgroundColor: '#000000',
    borderRadius: 12,
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    width: '100%',
  },
  toolbar: {
    backgroundColor: '#163A4A',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  pencilRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pencilIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF3F5',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  toolScroll: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  toolBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  toolBtnOn: {
    backgroundColor: 'rgba(229, 57, 53, 0.22)',
    borderColor: STROKE,
  },
  toolLabel: {
    color: '#D2E0E5',
    fontSize: 13,
    fontWeight: '700',
  },
  toolLabelOn: {
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryDisabled: {
    opacity: 0.4,
  },
  secondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  textModalRoot: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 36, 48, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  textCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    width: '100%',
  },
  textCardTitle: {
    color: '#163A4A',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#F7FAFB',
    borderColor: '#D8E0E4',
    borderRadius: 12,
    borderWidth: 1,
    color: '#163A4A',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  textCancel: {
    alignItems: 'center',
    borderColor: '#D8E0E4',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  textCancelLabel: {
    color: '#526A74',
    fontWeight: '700',
  },
  textConfirm: {
    alignItems: 'center',
    backgroundColor: '#E17035',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  textConfirmLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
