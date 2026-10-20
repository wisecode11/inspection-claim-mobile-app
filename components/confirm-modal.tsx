import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Brand } from '@/constants/theme';

/**
 * Centered confirm / info dialog — same design as the Profile "Log out?" modal.
 * Omit `cancelLabel` for a single-button (acknowledge) dialog.
 */
export function ConfirmModal({
  visible,
  icon,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  icon: IconName;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shows a spinner on the confirm button and blocks dismissing. */
  busy?: boolean;
  /** Red confirm button, e.g. for sending an incomplete package. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  const dismiss = () => {
    if (busy) return;
    (onCancel ?? onConfirm)();
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={[styles.icon, danger && styles.iconDanger]}>
            <Icon color={danger ? Danger : Brand.accent} name={icon} size={26} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>{message}</Text>
          <View style={styles.actions}>
            {cancelLabel ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onCancel}
                style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirm,
                danger && styles.confirmDanger,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const Danger = '#C2410C';

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 58, 66, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 22,
    padding: 22,
    width: '100%',
  },
  icon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    marginBottom: 14,
    width: 52,
  },
  iconDanger: {
    backgroundColor: '#FDECE3',
  },
  title: {
    color: Brand.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  copy: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  cancel: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderRadius: Brand.buttonRadius,
    flex: 1,
    paddingVertical: 14,
  },
  cancelText: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  confirm: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadius,
    flex: 1,
    paddingVertical: 14,
  },
  confirmDanger: {
    backgroundColor: Danger,
  },
  confirmText: {
    color: Brand.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
});
