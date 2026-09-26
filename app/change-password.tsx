import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { changeMyPassword } from '@/lib/api';
import { getStableDeviceId } from '@/lib/device-id';

const MIN_LENGTH = 8;

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  inputRef,
  returnKeyType = 'next',
  onSubmitEditing,
  isNew = false,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  inputRef?: React.RefObject<TextInput | null>;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
  /** New passwords get the "new-password" hint so password managers offer to generate one. */
  isNew?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput
          autoCapitalize="none"
          autoComplete={isNew ? 'new-password' : 'current-password'}
          autoCorrect={false}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={Brand.soft}
          ref={inputRef}
          returnKeyType={returnKeyType}
          secureTextEntry={!visible}
          style={styles.input}
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          textContentType={isNew ? 'newPassword' : 'password'}
          value={value}
        />
        <Pressable
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setVisible((v) => !v)}
          style={styles.eyeBtn}
        >
          <Icon color={Brand.soft} name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} />
        </Pressable>
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { token, replaceSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);

  const onDone = () => {
    setSuccessOpen(false);
    router.back();
  };

  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // The backend trims passwords, so validate the same way it will.
  const current = currentPassword.trim();
  const next = newPassword.trim();
  const confirm = confirmPassword.trim();

  const newError =
    next && next.length < MIN_LENGTH
      ? `Use at least ${MIN_LENGTH} characters.`
      : next && current && next === current
        ? 'Choose a password different from your current one.'
        : '';
  const confirmError = confirm && confirm !== next ? 'Passwords do not match.' : '';

  const canSave =
    Boolean(current) &&
    next.length >= MIN_LENGTH &&
    next === confirm &&
    next !== current &&
    !saving;

  const onSave = async () => {
    if (!token || !canSave) return;

    setError('');
    setSaving(true);
    try {
      const deviceId = await getStableDeviceId();
      const result = await changeMyPassword(token, {
        currentPassword: current,
        newPassword: next,
        deviceId,
      });
      await replaceSession(result);
      setSuccessOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Icon color={Brand.accent} name="lock-closed-outline" size={24} />
            </View>
            <Text style={styles.introCopy}>
              Enter your current password, then choose a new one. You&apos;ll stay signed in on this
              device; other devices will be signed out.
            </Text>
          </View>

          <View style={styles.card}>
            <PasswordField
              label="Current password"
              onChangeText={setCurrentPassword}
              onSubmitEditing={() => newRef.current?.focus()}
              placeholder="Current password"
              value={currentPassword}
            />
            <PasswordField
              error={newError}
              hint={`At least ${MIN_LENGTH} characters.`}
              inputRef={newRef}
              isNew
              label="New password"
              onChangeText={setNewPassword}
              onSubmitEditing={() => confirmRef.current?.focus()}
              placeholder="New password"
              value={newPassword}
            />
            <PasswordField
              error={confirmError}
              inputRef={confirmRef}
              isNew
              label="Confirm new password"
              onChangeText={setConfirmPassword}
              onSubmitEditing={() => void onSave()}
              placeholder="Re-enter new password"
              returnKeyType="done"
              value={confirmPassword}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={() => void onSave()}
            style={({ pressed }) => [
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
              pressed && canSave && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Update password</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal animationType="fade" onRequestClose={onDone} transparent visible={successOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Icon color={Brand.accent} name="checkmark-circle-outline" size={26} />
            </View>
            <Text style={styles.modalTitle}>Password updated</Text>
            <Text style={styles.modalCopy}>
              Your password has been changed. Any other devices signed in to your account have been
              signed out.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onDone}
              style={({ pressed }) => [styles.modalConfirm, pressed && styles.pressed]}
            >
              <Text style={styles.modalConfirmText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    backgroundColor: Brand.sheetBg,
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  intro: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  introIcon: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
    width: 52,
  },
  introCopy: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 1,
    marginBottom: 16,
    padding: 18,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  field: {
    marginTop: 12,
  },
  fieldLabel: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: Brand.buttonRadiusLg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
  },
  inputWrapError: {
    borderColor: Brand.danger,
  },
  input: {
    color: Brand.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  eyeBtn: {
    paddingHorizontal: 14,
  },
  fieldHint: {
    color: Brand.soft,
    fontSize: 12,
    marginTop: 6,
  },
  fieldError: {
    color: Brand.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  error: {
    color: Brand.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadiusLg,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 58, 66, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Brand.surface,
    borderRadius: 22,
    padding: 22,
    width: '100%',
  },
  modalIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    marginBottom: 14,
    width: 52,
  },
  modalTitle: {
    color: Brand.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalCopy: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  modalConfirm: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadius,
    marginTop: 22,
    paddingVertical: 14,
  },
  modalConfirmText: {
    color: Brand.surface,
    fontSize: 15,
    fontWeight: '800',
  },
});
