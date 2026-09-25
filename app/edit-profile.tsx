import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { removeMyAvatar, resolveApiUrl, updateMyProfile, uploadMyAvatar } from '@/lib/api';

const AVATAR_SIZE = 104;
const AVATAR_UPLOAD_PX = 512;
const AVATAR_JPEG_QUALITY = 0.8;

type PhotoSource = 'camera' | 'library';

// iOS refuses to present the picker/alert while the sheet Modal is still animating out.
const SHEET_CLOSE_MS = 350;
const waitForSheetClose = () =>
  new Promise<void>((resolve) => setTimeout(resolve, Platform.OS === 'ios' ? SHEET_CLOSE_MS : 0));

/** Square-crop result → 512px JPEG base64, small enough (~50 KB) to store in Mongo. */
async function prepareAvatar(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > AVATAR_UPLOAD_PX) {
    context.resize({ width: AVATAR_UPLOAD_PX, height: null });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    base64: true,
    compress: AVATAR_JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  if (!result.base64) {
    throw new Error('Could not process the photo');
  }
  return result.base64;
}

async function pickPhoto(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset | null> {
  const options: ImagePicker.ImagePickerOptions = {
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 1,
  };

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take a profile photo.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      ...options,
      cameraType: ImagePicker.CameraType.front,
    });
    return result.canceled ? null : (result.assets[0] ?? null);
  }

  const result = await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0] ?? null);
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'words',
  editable = true,
  hint,
}: {
  label: string;
  value: string;
  onChangeText?: (next: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'characters';
  editable?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Brand.soft}
        style={[styles.input, !editable && styles.inputReadOnly]}
        value={value}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function SheetOption({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? Brand.danger : Brand.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
    >
      <View style={[styles.sheetOptionIcon, danger && styles.sheetOptionIconDanger]}>
        <Icon color={color} name={icon} size={20} />
      </View>
      <Text style={[styles.sheetOptionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { token, user, updateUser } = useAuth();

  const initial = {
    firstName: user?.profile?.firstName?.trim() || '',
    lastName: user?.profile?.lastName?.trim() || '',
    phone: user?.profile?.phone?.trim() || '',
    licenseNumber: user?.profile?.licenseNumber?.trim() || '',
  };
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone);
  const [licenseNumber, setLicenseNumber] = useState(initial.licenseNumber);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Local preview while the upload is in flight, so the new photo shows instantly.
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const avatarUri = previewUri || resolveApiUrl(user?.profile?.avatarUrl);
  const avatarInitial =
    firstName.trim().charAt(0).toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'I';

  const dirty =
    firstName.trim() !== initial.firstName ||
    lastName.trim() !== initial.lastName ||
    phone.trim() !== initial.phone ||
    licenseNumber.trim() !== initial.licenseNumber;
  const canSave = dirty && Boolean(firstName.trim()) && !saving && !photoBusy;

  const onChoosePhoto = async (source: PhotoSource) => {
    setSheetOpen(false);
    if (!token) return;
    await waitForSheetClose();

    try {
      const asset = await pickPhoto(source);
      if (!asset) return;

      setPreviewUri(asset.uri);
      setPhotoBusy(true);
      const base64 = await prepareAvatar(asset);
      const nextUser = await uploadMyAvatar(token, base64);
      await updateUser(nextUser);
    } catch (err) {
      Alert.alert(
        'Photo not updated',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setPreviewUri(null);
      setPhotoBusy(false);
    }
  };

  const onRemovePhoto = async () => {
    setSheetOpen(false);
    if (!token) return;
    await waitForSheetClose();

    Alert.alert('Remove profile photo?', 'Your initial will be shown instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            const nextUser = await removeMyAvatar(token);
            await updateUser(nextUser);
          } catch (err) {
            Alert.alert(
              'Photo not removed',
              err instanceof Error ? err.message : 'Please try again.',
            );
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  const onSave = async () => {
    if (!token || !canSave) return;

    setError('');
    setSaving(true);
    try {
      const nextUser = await updateMyProfile(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        licenseNumber: licenseNumber.trim(),
      });
      await updateUser(nextUser);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
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
          <View style={styles.avatarSection}>
            <Pressable
              accessibilityLabel="Change profile photo"
              accessibilityRole="button"
              disabled={photoBusy}
              onPress={() => setSheetOpen(true)}
              style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                {avatarUri ? (
                  <Image
                    contentFit="cover"
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    transition={150}
                  />
                ) : (
                  <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                )}
                {photoBusy ? (
                  <View style={styles.avatarBusy}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <View style={styles.avatarBadge}>
                <Icon color="#FFFFFF" name="camera-outline" size={16} />
              </View>
            </Pressable>
            <Pressable
              disabled={photoBusy}
              hitSlop={8}
              onPress={() => setSheetOpen(true)}
            >
              <Text style={styles.changePhoto}>
                {photoBusy ? 'Updating photo…' : 'Change profile photo'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal details</Text>
            <Field
              label="First name"
              onChangeText={setFirstName}
              placeholder="First name"
              value={firstName}
            />
            <Field
              label="Last name"
              onChangeText={setLastName}
              placeholder="Last name"
              value={lastName}
            />
            <Field
              autoCapitalize="none"
              keyboardType="phone-pad"
              label="Phone number"
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              value={phone}
            />
            <Field
              autoCapitalize="characters"
              label="License ID"
              onChangeText={setLicenseNumber}
              placeholder="License number"
              value={licenseNumber}
            />
            <Field
              autoCapitalize="none"
              editable={false}
              hint="Contact your company admin to change your email."
              label="Email address"
              value={user?.email || ''}
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
              <Text style={styles.saveText}>Save changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
        transparent
        visible={sheetOpen}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Profile photo</Text>
            <SheetOption
              icon="camera-outline"
              label="Take photo"
              onPress={() => void onChoosePhoto('camera')}
            />
            <SheetOption
              icon="image-outline"
              label="Choose from library"
              onPress={() => void onChoosePhoto('library')}
            />
            {user?.profile?.avatarUrl ? (
              <SheetOption danger icon="trash-outline" label="Remove photo" onPress={() => void onRemovePhoto()} />
            ) : null}
            <Pressable
              onPress={() => setSheetOpen(false)}
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  avatarWrap: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderColor: '#FFFFFF',
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '300',
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(19,58,66,0.45)',
    justifyContent: 'center',
  },
  avatarBadge: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    bottom: 2,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 32,
  },
  changePhoto: {
    color: Brand.accent,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 1,
    marginBottom: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardTitle: {
    color: '#1A1A1A',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 6,
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
  input: {
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: Brand.buttonRadiusLg,
    borderWidth: 1,
    color: Brand.ink,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  inputReadOnly: {
    backgroundColor: Brand.background,
    color: Brand.muted,
  },
  fieldHint: {
    color: Brand.soft,
    fontSize: 12,
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
  sheetBackdrop: {
    backgroundColor: 'rgba(19, 58, 66, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: Brand.border,
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  sheetTitle: {
    color: Brand.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  sheetOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
  },
  sheetOptionIcon: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sheetOptionIconDanger: {
    backgroundColor: '#FBEAE8',
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetCancel: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderRadius: Brand.buttonRadius,
    marginTop: 12,
    paddingVertical: 14,
  },
  sheetCancelText: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '800',
  },
});
