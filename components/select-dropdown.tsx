import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';

type SingleProps = {
  label: string;
  options: string[];
  selected: string;
  multi?: false;
  placeholder?: string;
  compact?: boolean;
  onChange: (value: string) => void;
};

type MultiProps = {
  label: string;
  options: string[];
  selected: string[];
  multi: true;
  placeholder?: string;
  compact?: boolean;
  onChange: (value: string[]) => void;
};

type Props = SingleProps | MultiProps;

/**
 * Fabric-safe dropdown: Modal is mounted only while open, and closed before unmount
 * to avoid Android "Unable to find viewState for tag" crashes.
 */
export function SelectDropdown(props: Props) {
  const { label, options, placeholder = 'Select…', compact = false } = props;
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return () => {
      setOpen(false);
    };
  }, []);

  const summary = useMemo(() => {
    if (props.multi) {
      if (!props.selected.length) return placeholder;
      if (props.selected.length === 1) return props.selected[0];
      return `${props.selected.length} selected`;
    }
    return props.selected || placeholder;
  }, [placeholder, props]);

  const hasValue = props.multi ? props.selected.length > 0 : Boolean(props.selected);

  const close = () => setOpen(false);

  const toggleOption = (option: string) => {
    if (props.multi) {
      const next = props.selected.includes(option)
        ? props.selected.filter((item) => item !== option)
        : [...props.selected, option];
      props.onChange(next);
      return;
    }
    props.onChange(option === props.selected ? '' : option);
    close();
  };

  const isActive = (option: string) =>
    props.multi ? props.selected.includes(option) : props.selected === option;

  return (
    <View style={styles.wrap} collapsable={false}>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          pressed && styles.triggerPressed,
        ]}
      >
        <Text style={[styles.triggerText, !hasValue && styles.triggerPlaceholder]} numberOfLines={1}>
          {summary}
        </Text>
        <Ionicons color="#526A74" name="chevron-down" size={18} />
      </Pressable>

      {props.multi && props.selected.length > 0 ? (
        <View style={styles.selectedWrap}>
          {props.selected.map((item) => (
            <Pressable
              key={item}
              style={styles.selectedChip}
              onPress={() => props.onChange(props.selected.filter((entry) => entry !== item))}
            >
              <Text style={styles.selectedChipText}>{item}</Text>
              <Ionicons color="#133A42" name="close" size={14} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {open ? (
        <Modal
          visible
          transparent
          animationType={Platform.OS === 'android' ? 'fade' : 'slide'}
          statusBarTranslucent
          hardwareAccelerated
          onRequestClose={close}
        >
          <View style={styles.modalRoot} collapsable={false}>
            <Pressable style={styles.backdrop} onPress={close} />
            <View
              style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
              collapsable={false}
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable hitSlop={10} onPress={close} style={styles.doneBtn}>
                  <Text style={styles.doneText}>{props.multi ? 'Done' : 'Close'}</Text>
                </Pressable>
              </View>
              {props.multi ? <Text style={styles.hint}>Tap to select one or more</Text> : null}
              <FlatList
                data={options}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                renderItem={({ item }) => {
                  const active = isActive(item);
                  return (
                    <Pressable
                      style={[styles.option, active && styles.optionOn]}
                      onPress={() => toggleOption(item)}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextOn]}>{item}</Text>
                      {active ? <Ionicons color="#FFFFFF" name="checkmark" size={18} /> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 0 },
  label: {
    color: '#133A42',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  labelCompact: {
    color: '#60737D',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C5D0D6',
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerCompact: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E9EC',
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerPressed: { opacity: 0.88 },
  triggerText: {
    color: '#133A42',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  triggerPlaceholder: { color: '#84949C', fontWeight: '600' },
  selectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  selectedChip: {
    alignItems: 'center',
    backgroundColor: '#EEF3F5',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedChipText: { color: '#133A42', fontSize: 12, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 35, 45, 0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '72%',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { color: '#133A42', fontSize: 17, fontWeight: '800' },
  doneBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  doneText: { color: Brand.accent, fontSize: 15, fontWeight: '800' },
  hint: { color: '#60737D', fontSize: 13, marginBottom: 8 },
  option: {
    alignItems: 'center',
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingVertical: 14,
  },
  optionOn: {
    backgroundColor: '#133A42',
    borderBottomWidth: 0,
    borderRadius: 12,
    marginVertical: 2,
    paddingHorizontal: 12,
  },
  optionText: { color: '#133A42', flex: 1, fontSize: 15, fontWeight: '600' },
  optionTextOn: { color: '#FFFFFF', fontWeight: '700' },
});
