import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton, Screen, ui } from '@/components/inspection-ui';
import { Brand } from '@/constants/theme';
import { useInspection } from '@/context/inspection-context';
import { CAPTURE_STEPS, type CaptureStep, type PhotoItem, type StepId } from '@/lib/capture-steps';
import { captureHref } from '@/lib/routes';

type StepSubOption = {
  key: string;
  title: string;
  label: string;
  component?: string;
  elevation?: string;
  roofDirection?: string;
  damageTags?: string[];
};

function getStepSubOptions(step: CaptureStep): StepSubOption[] {
  if (step.slots?.length) {
    return step.slots.map((slot) => ({
      key: `slot-${slot}`,
      title: slot,
      label: slot,
    }));
  }

  if (step.mode === 'components' || step.mode === 'metal' || step.mode === 'checklist') {
    return (step.components || []).map((component) => ({
      key: `component-${component}`,
      title: component,
      label: component,
      component,
    }));
  }

  if (step.mode === 'fast' && step.locationTags?.length) {
    return step.locationTags.map((elevation) => ({
      key: `elevation-${elevation}`,
      title: elevation,
      label: `Spatter · ${elevation}`,
      elevation,
    }));
  }

  if (step.directionTags?.length) {
    return step.directionTags.map((direction) => ({
      key: `direction-${direction}`,
      title: direction,
      label: `${step.title} · ${direction}`,
      roofDirection: direction,
    }));
  }

  if (step.damageTags?.length) {
    return step.damageTags.map((tag) => ({
      key: `tag-${tag}`,
      title: tag,
      label: tag,
      damageTags: [tag],
    }));
  }

  return [
    {
      key: `general-${step.id}`,
      title: 'General photo',
      label: step.title,
    },
  ];
}

export default function ReportDraftScreen() {
  const router = useRouter();
  const { data, update, updatePhoto, addPhotos, removePhoto } = useInspection();
  const [adding, setAdding] = useState(false);
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<StepId | null>(null);

  const includedCount = useMemo(
    () => data.photos.filter((photo) => photo.includeInReport !== false).length,
    [data.photos]
  );

  const setBuildText = (key: keyof typeof data.buildNotes.texts, value: string) => {
    update({
      buildNotes: {
        ...data.buildNotes,
        texts: {
          ...data.buildNotes.texts,
          [key]: value,
        },
      },
    });
  };

  const openStep = (stepId: StepId) => {
    update({ currentStepId: stepId });
    router.push(captureHref(stepId));
  };

  const pickImages = async (fromCamera: boolean) => {
    if (fromCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to add inspection photos.');
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.back,
        quality: 0.8,
      });
      if (result.canceled) return null;
      return result.assets.map((asset) => asset.uri);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 8,
    });
    if (result.canceled) return null;
    return result.assets.map((asset) => asset.uri);
  };

  const addPhotosToStep = async (stepId: StepId, option?: StepSubOption) => {
    if (adding) return;
    const step = CAPTURE_STEPS.find((item) => item.id === stepId);

    const chooseSource = () =>
      new Promise<'camera' | 'library' | null>((resolve) => {
        Alert.alert('Add photo', 'Choose a source', [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          { text: 'Camera', onPress: () => resolve('camera') },
          { text: 'Gallery', onPress: () => resolve('library') },
        ]);
      });

    const source = await chooseSource();
    if (!source) return;

    try {
      setAdding(true);
      const uris = await pickImages(source === 'camera');
      if (!uris?.length) return;
      addPhotos(uris, {
        stepId,
        label: option?.label || step?.title || 'Photo',
        component: option?.component,
        elevation: option?.elevation,
        roofDirection: option?.roofDirection,
        damageTags: option?.damageTags ?? [],
      });
    } finally {
      setAdding(false);
    }
  };

  const selectSubOption = (stepId: StepId, option: StepSubOption) => {
    setStepPickerOpen(false);
    setExpandedStepId(null);
    setTimeout(() => {
      void addPhotosToStep(stepId, option);
    }, 250);
  };

  const toggleStepAccordion = (stepId: StepId) => {
    setExpandedStepId((current) => (current === stepId ? null : stepId));
  };

  const confirmDelete = (photo: PhotoItem) => {
    Alert.alert('Delete photo?', 'This removes the photo from the inspection draft.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removePhoto(photo.id),
      },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Text style={ui.title}>Editable PDF draft</Text>
        <Text style={ui.subtitle}>
          Review and edit report details before generating the final Evidence Package PDF.
        </Text>

        <Text style={styles.section}>Property & claim</Text>
        <View style={ui.card}>
          <Text style={[styles.label, styles.labelFirst]}>Homeowner</Text>
          <TextInput
            style={ui.input}
            value={data.homeownerName}
            onChangeText={(homeownerName) => update({ homeownerName })}
            placeholder="Homeowner name"
            placeholderTextColor={Brand.soft}
          />

          <Text style={styles.label}>Inspector</Text>
          <TextInput
            style={ui.input}
            value={data.inspectorName}
            onChangeText={(inspectorName) => update({ inspectorName })}
            placeholder="Inspector name"
            placeholderTextColor={Brand.soft}
          />

          <Text style={styles.label}>Claim number</Text>
          <TextInput
            style={ui.input}
            value={data.claimNumber}
            onChangeText={(claimNumber) => update({ claimNumber })}
            placeholder="Claim #"
            placeholderTextColor={Brand.soft}
          />

          <Text style={styles.label}>Policy number</Text>
          <TextInput
            style={ui.input}
            value={data.policyNumber}
            onChangeText={(policyNumber) => update({ policyNumber })}
            placeholder="Policy #"
            placeholderTextColor={Brand.soft}
          />

          <Text style={styles.label}>Estimated roof age</Text>
          <TextInput
            style={ui.input}
            value={data.estimatedRoofAge}
            onChangeText={(estimatedRoofAge) => update({ estimatedRoofAge })}
            placeholder="e.g. 12 years"
            placeholderTextColor={Brand.soft}
          />
        </View>

        <Text style={styles.section}>Build notes</Text>
        <View style={ui.card}>
          <Text style={[styles.label, styles.labelFirst]}>Roof construction</Text>
          <TextInput
            style={[ui.input, styles.areaShort]}
            multiline
            textAlignVertical="top"
            value={data.buildNotes.texts.roofConstruction}
            onChangeText={(value) => setBuildText('roofConstruction', value)}
            placeholderTextColor={Brand.soft}
          />
          <Text style={styles.label}>Special conditions</Text>
          <TextInput
            style={[ui.input, styles.areaShort]}
            multiline
            textAlignVertical="top"
            value={data.buildNotes.texts.specialConditions}
            onChangeText={(value) => setBuildText('specialConditions', value)}
            placeholderTextColor={Brand.soft}
          />
          <Text style={styles.label}>Access / setup</Text>
          <TextInput
            style={[ui.input, styles.areaShort]}
            multiline
            textAlignVertical="top"
            value={data.buildNotes.texts.accessSetup}
            onChangeText={(value) => setBuildText('accessSetup', value)}
            placeholderTextColor={Brand.soft}
          />
          <Text style={styles.label}>Additional notes</Text>
          <TextInput
            style={[ui.input, styles.areaShort]}
            multiline
            textAlignVertical="top"
            value={data.buildNotes.texts.additionalBuildNotes}
            onChangeText={(value) => setBuildText('additionalBuildNotes', value)}
            placeholderTextColor={Brand.soft}
          />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionInline}>
            Photos in PDF ({includedCount}/{data.photos.length})
          </Text>
          <Pressable
            disabled={adding}
            onPress={() => {
              setExpandedStepId(null);
              setStepPickerOpen(true);
            }}
            style={({ pressed }) => [styles.addTopBtn, pressed && styles.pressed]}
          >
            <Ionicons color={Brand.accent} name="add-circle-outline" size={18} />
            <Text style={styles.addTopText}>{adding ? 'Adding…' : 'Add photo'}</Text>
          </Pressable>
        </View>
        <Text style={styles.hintOutside}>
          Include or exclude for the PDF, open the capture step, or add/delete photos here.
        </Text>

        <View style={styles.photoList}>
          {data.photos.map((photo) => {
            const included = photo.includeInReport !== false;
            const step = CAPTURE_STEPS.find((item) => item.id === photo.stepId);
            return (
              <View
                key={photo.id}
                style={[styles.photoCard, !included && styles.photoCardOff]}
              >
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                <View style={styles.photoBody}>
                  <Text style={styles.photoLabel} numberOfLines={1}>
                    {photo.label || step?.title || 'Photo'}
                  </Text>
                  <Text style={styles.photoStep} numberOfLines={1}>
                    {step ? `Step ${step.number}: ${step.title}` : photo.stepId}
                  </Text>

                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => updatePhoto(photo.id, { includeInReport: true })}
                      style={[styles.toggleBtn, included && styles.toggleOn]}
                    >
                      <Text style={[styles.toggleText, included && styles.toggleTextOn]}>
                        Include
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updatePhoto(photo.id, { includeInReport: false })}
                      style={[styles.toggleBtn, !included && styles.toggleOff]}
                    >
                      <Text style={[styles.toggleText, !included && styles.toggleTextOff]}>
                        Exclude
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => openStep(photo.stepId)}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Ionicons color={Brand.ink} name="open-outline" size={14} />
                      <Text style={styles.actionBtnText}>Open step</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(photo)}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Ionicons color={Brand.danger} name="trash-outline" size={14} />
                      <Text style={[styles.actionBtnText, styles.actionDanger]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {data.photos.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>No photos yet. Add one to include in the PDF.</Text>
            <Pressable
              disabled={adding}
              onPress={() => {
                setExpandedStepId(null);
                setStepPickerOpen(true);
              }}
              style={({ pressed }) => [styles.emptyAdd, pressed && styles.pressed]}
            >
              <Text style={styles.emptyAddText}>Add photo</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton title="Generate Final PDF" onPress={() => router.push('/report')} />
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backText}>Back to review</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={stepPickerOpen}
        onRequestClose={() => setStepPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add photo to step</Text>
            <Text style={styles.modalSub}>
              Open a step, then choose Front / Left / Right or the matching option.
            </Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {CAPTURE_STEPS.map((step, index) => {
                const expanded = expandedStepId === step.id;
                const options = getStepSubOptions(step);
                return (
                  <View
                    key={step.id}
                    style={[
                      styles.accordionBlock,
                      index === CAPTURE_STEPS.length - 1 && styles.modalRowLast,
                    ]}
                  >
                    <Pressable
                      onPress={() => toggleStepAccordion(step.id)}
                      style={({ pressed }) => [styles.modalRow, pressed && styles.pressed]}
                    >
                      <View style={styles.modalStepBadge}>
                        <Text style={styles.modalStepNum}>{step.number}</Text>
                      </View>
                      <Text style={styles.modalRowText}>{step.title}</Text>
                      <Ionicons
                        color={Brand.soft}
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                      />
                    </Pressable>

                    {expanded ? (
                      <View style={styles.subList}>
                        {options.map((option) => (
                          <Pressable
                            key={option.key}
                            onPress={() => selectSubOption(step.id, option)}
                            style={({ pressed }) => [
                              styles.subRow,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={styles.subRowText}>{option.title}</Text>
                            <Ionicons color={Brand.accent} name="add-circle-outline" size={18} />
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => {
                setStepPickerOpen(false);
                setExpandedStepId(null);
              }}
              style={({ pressed }) => [styles.modalCancel, pressed && styles.pressed]}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 22,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 22,
  },
  sectionInline: {
    color: Brand.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    marginRight: 8,
  },
  addTopBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  addTopText: {
    color: Brand.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  label: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  labelFirst: {
    marginTop: 0,
  },
  hintOutside: {
    color: Brand.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  areaShort: {
    minHeight: 72,
    paddingTop: 12,
  },
  photoList: {
    gap: 12,
  },
  photoCard: {
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  photoCardOff: {
    opacity: 0.72,
  },
  photoThumb: {
    backgroundColor: '#E8EEF0',
    height: 132,
    width: 108,
  },
  photoBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  photoLabel: {
    color: Brand.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  photoStep: {
    color: Brand.muted,
    fontSize: 12,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  toggleBtn: {
    backgroundColor: Brand.background,
    borderColor: Brand.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleOn: {
    backgroundColor: '#E7F6EC',
    borderColor: '#1F7A45',
  },
  toggleOff: {
    backgroundColor: '#FDECEC',
    borderColor: Brand.danger,
  },
  toggleText: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  toggleTextOn: {
    color: '#1F7A45',
  },
  toggleTextOff: {
    color: Brand.danger,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionBtnText: {
    color: Brand.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  actionDanger: {
    color: Brand.danger,
  },
  emptyBox: {
    alignItems: 'flex-start',
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    padding: 16,
  },
  empty: {
    color: Brand.muted,
    fontSize: 14,
  },
  emptyAdd: {
    marginTop: 10,
  },
  emptyAddText: {
    color: Brand.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    marginTop: 28,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 14,
    padding: 10,
  },
  backText: {
    color: Brand.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(27, 67, 50, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: Brand.surface,
    borderRadius: 22,
    maxHeight: '78%',
    paddingBottom: Platform.OS === 'ios' ? 10 : 14,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  modalTitle: {
    color: Brand.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSub: {
    color: Brand.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: 6,
  },
  modalList: {
    maxHeight: 420,
  },
  modalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  accordionBlock: {
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: 1,
  },
  modalRowLast: {
    borderBottomWidth: 0,
  },
  subList: {
    backgroundColor: Brand.background,
    borderRadius: 12,
    marginBottom: 12,
    marginLeft: 44,
    overflow: 'hidden',
  },
  subRow: {
    alignItems: 'center',
    borderBottomColor: '#E4EBEE',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  subRowText: {
    color: Brand.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  modalStepBadge: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalStepNum: {
    color: Brand.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  modalRowText: {
    color: Brand.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancel: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderRadius: Brand.buttonRadius,
    marginTop: 10,
    paddingVertical: 14,
  },
  modalCancelText: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '800',
  },
});
