import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton, ui } from '@/components/inspection-ui';
import { PhotoAnnotator } from '@/components/photo-annotator';
import { SelectDropdown } from '@/components/select-dropdown';
import { useInspection } from '@/context/inspection-context';
import {
  BUILD_NOTE_FIELDS,
  BUILD_NOTE_TEXT_KEYS,
  BUILD_NOTE_TEXT_LABELS,
  CAPTURE_STEPS,
  CaptureStep,
  PhotoItem,
  StepId,
} from '@/lib/capture-steps';

type Props = {
  step: CaptureStep;
  onContinue: () => void;
};

function ChipRow({
  options,
  selected,
  multi = false,
  onChange,
}: {
  options: string[];
  selected: string | string[];
  multi?: boolean;
  onChange: (value: string | string[]) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const active = multi
          ? (selected as string[]).includes(option)
          : selected === option;
        return (
          <Pressable
            key={option}
            style={[styles.chip, active && styles.chipOn]}
            onPress={() => {
              if (multi) {
                const list = selected as string[];
                onChange(
                  list.includes(option) ? list.filter((item) => item !== option) : [...list, option]
                );
              } else {
                onChange(option === selected ? '' : option);
              }
            }}
          >
            <Text style={[styles.chipText, active && styles.chipTextOn]} numberOfLines={1}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PhotoGrid({
  photos,
  onRemove,
  onSetCover,
  onReorder,
  onMove,
  onAnnotate,
  showCover,
}: {
  photos: PhotoItem[];
  onRemove: (id: string) => void;
  onSetCover?: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onMove: (id: string) => void;
  onAnnotate?: (photo: PhotoItem) => void;
  showCover?: boolean;
}) {
  if (photos.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <View style={styles.emptyLens} />
        </View>
        <Text style={styles.emptyTitle}>Ready to capture</Text>
        <Text style={styles.emptyText}>Take or upload photos for this step. They will show up here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => (
        <View key={photo.id} style={styles.photoWrap}>
          <Pressable
            onPress={() => {
              if (onAnnotate) onAnnotate(photo);
            }}
            style={styles.photoTap}
          >
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <View style={styles.annotateBadge}>
              <Text style={styles.annotateBadgeText}>Mark</Text>
            </View>
          </Pressable>
          <Text style={styles.caption} numberOfLines={2}>
            {photo.label}
            {photo.shotType && photo.shotType !== 'standard' ? ` · ${photo.shotType}` : ''}
            {photo.damageTags.length ? ` · ${photo.damageTags.join(', ')}` : ''}
            {photo.notes ? ` · ${photo.notes}` : ''}
          </Text>
          <View style={styles.photoActions}>
            <Pressable
              disabled={index === 0}
              onPress={() => onReorder(photo.id, 'up')}
              style={[styles.miniBtn, index === 0 && styles.miniDisabled]}
            >
              <Text style={styles.miniText}>↑</Text>
            </Pressable>
            <Pressable
              disabled={index === photos.length - 1}
              onPress={() => onReorder(photo.id, 'down')}
              style={[styles.miniBtn, index === photos.length - 1 && styles.miniDisabled]}
            >
              <Text style={styles.miniText}>↓</Text>
            </Pressable>
            <Pressable onPress={() => onMove(photo.id)} style={styles.miniBtn}>
              <Text style={styles.miniText}>Move</Text>
            </Pressable>
          </View>
          {showCover ? (
            <Pressable onPress={() => onSetCover?.(photo.id)}>
              <Text style={styles.coverLink}>{photo.isCover ? '★ Cover photo' : 'Set as cover'}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onRemove(photo.id)}>
            <Text style={styles.delete}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function StepCapture({ step, onContinue }: Props) {
  const {
    data,
    addPhotos,
    removePhoto,
    setCoverPhoto,
    update,
    reorderPhoto,
    movePhotoToStep,
  } = useInspection();
  const stepPhotos = useMemo(
    () => data.photos.filter((photo) => photo.stepId === step.id),
    [data.photos, step.id]
  );

  const [activeSlot, setActiveSlot] = useState(step.slots?.[0] ?? '');
  const [activeComponent, setActiveComponent] = useState(step.components?.[0] ?? '');
  const [elevation, setElevation] = useState('');
  const [direction, setDirection] = useState(data.lastRoofDirection || '');
  const [damageTags, setDamageTags] = useState<string[]>([]);
  const [metalShot, setMetalShot] = useState<'overview' | 'close-up'>('overview');
  const [labelOverride, setLabelOverride] = useState('');
  const [photoNotes, setPhotoNotes] = useState('');
  const [movingPhotoId, setMovingPhotoId] = useState<string | null>(null);
  const [annotatingPhoto, setAnnotatingPhoto] = useState<PhotoItem | null>(null);

  const openAnnotator = (photo: PhotoItem) => {
    setAnnotatingPhoto(photo);
  };

  const pickImages = async (fromCamera: boolean, allowMultiple = false) => {
    if (fromCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to add inspection photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.back,
        quality: 0.8,
      });
      if (result.canceled) return;
      return result.assets.map((asset) => asset.uri);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: allowMultiple,
      selectionLimit: allowMultiple ? 12 : 1,
    });
    if (result.canceled) return;
    return result.assets.map((asset) => asset.uri);
  };

  const capture = async (fromCamera: boolean, allowMultiple = false) => {
    const uris = await pickImages(fromCamera, allowMultiple);
    if (!uris?.length) return;

    let label = labelOverride.trim();
    let component: string | undefined;
    let shotType: PhotoItem['shotType'] = 'standard';

    if (step.mode === 'slots') {
      label = activeSlot || label || step.title;
    } else if (step.mode === 'components' || step.mode === 'checklist') {
      component = activeComponent;
      label = activeComponent || label || step.title;
    } else if (step.mode === 'metal') {
      component = activeComponent;
      shotType = metalShot;
      label = `${activeComponent} (${metalShot})`;
    } else if (step.mode === 'fast') {
      label = label || `Spatter${elevation ? ` · ${elevation}` : ''}`;
    } else if (step.mode === 'tagged') {
      label = label || step.title;
    } else if (step.mode === 'build-notes') {
      label = label || 'Build Notes';
    }

    addPhotos(uris, {
      stepId: step.id,
      label,
      component,
      elevation: elevation || undefined,
      roofDirection: direction || undefined,
      damageTags,
      shotType,
      notes: step.mode === 'metal' ? photoNotes.trim() || undefined : undefined,
    });

    if (step.mode === 'metal' && metalShot === 'overview') {
      setMetalShot('close-up');
    } else if (step.mode === 'metal' && metalShot === 'close-up') {
      setMetalShot('overview');
    }
  };

  const toggleTieIn = (item: string) => {
    const selected = data.buildNotes.selectedTieIns;
    update({
      buildNotes: {
        ...data.buildNotes,
        selectedTieIns: selected.includes(item)
          ? selected.filter((entry) => entry !== item)
          : [...selected, item],
      },
    });
  };

  const promptMove = (photoId: string) => {
    setMovingPhotoId(photoId);
  };

  return (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>STEP {step.number}</Text>
          <View style={[styles.countPill, stepPhotos.length > 0 && styles.countPillActive]}>
            <Text style={[styles.count, stepPhotos.length > 0 && styles.countActive]}>
              {stepPhotos.length} photo{stepPhotos.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        <Text style={ui.title}>{step.title}</Text>
        <Text style={ui.subtitle}>{step.subtitle}</Text>
      </View>

      {movingPhotoId ? (
        <View style={styles.moveCard}>
          <Text style={styles.moveTitle}>Move photo to step</Text>
          <View style={styles.chipWrap}>
            {CAPTURE_STEPS.filter((entry) => entry.id !== step.id).map((entry) => (
              <Pressable
                key={entry.id}
                style={styles.chip}
                onPress={() => {
                  movePhotoToStep(movingPhotoId, entry.id as StepId, entry.title);
                  setMovingPhotoId(null);
                }}
              >
                <Text style={styles.chipText}>
                  {entry.number}. {entry.title}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setMovingPhotoId(null)} style={styles.cancelMove}>
            <Text style={styles.cancelMoveText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.quickBar}>
        <Pressable style={styles.capture} onPress={() => void capture(true)}>
          <Text style={styles.captureText}>Take Photo</Text>
        </Pressable>
        <Pressable style={styles.gallery} onPress={() => void capture(false, true)}>
          <Text style={styles.galleryText}>Upload</Text>
        </Pressable>
      </View>
      {(step.mode === 'tagged' || step.mode === 'fast' || step.mode === 'metal') && (
        <Pressable style={styles.another} onPress={() => void capture(true)}>
          <Text style={styles.anotherText}>Take Another</Text>
        </Pressable>
      )}

      {step.mode === 'slots' && step.slots ? (
        <View style={styles.sectionCard}>
          <SelectDropdown
            label="Capture for"
            options={step.slots}
            selected={activeSlot}
            placeholder="Select elevation / structure"
            onChange={setActiveSlot}
          />
        </View>
      ) : null}

      {(step.mode === 'components' || step.mode === 'metal' || step.mode === 'checklist') &&
      step.components ? (
        <View style={styles.sectionCard}>
          <SelectDropdown
            label="Component"
            options={step.components}
            selected={activeComponent}
            placeholder="Select a component"
            onChange={setActiveComponent}
          />
        </View>
      ) : null}

      {step.mode === 'checklist' && step.components ? (
        <>
          <Text style={styles.label}>Mark present</Text>
          <View style={styles.listCard}>
            {step.components.map((item) => {
              const on = data.buildNotes.selectedTieIns.includes(item);
              return (
                <Pressable key={item} style={styles.listRow} onPress={() => toggleTieIn(item)}>
                  <View style={[styles.check, on && styles.checkOn]}>
                    <Text style={styles.checkMark}>{on ? '✓' : ''}</Text>
                  </View>
                  <Text style={styles.listText}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {step.mode === 'metal' ? (
        <>
          <Text style={styles.label}>Shot type</Text>
          <ChipRow
            options={['overview', 'close-up']}
            selected={metalShot}
            onChange={(value) => setMetalShot(value as 'overview' | 'close-up')}
          />
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[ui.input, styles.notesInput]}
            multiline
            textAlignVertical="top"
            placeholder="Optional notes for this metal photo"
            placeholderTextColor="#8A9AA3"
            value={photoNotes}
            onChangeText={setPhotoNotes}
          />
        </>
      ) : null}

      {step.locationTags?.length ? (
        <View style={styles.sectionCard}>
          <SelectDropdown
            label="Elevation / location"
            options={[...step.locationTags]}
            selected={elevation}
            placeholder="Select elevation / location"
            onChange={setElevation}
          />
        </View>
      ) : null}

      {step.directionTags?.length ? (
        <View style={styles.sectionCard}>
          <SelectDropdown
            label="Roof direction"
            options={[...step.directionTags]}
            selected={direction}
            placeholder="Select roof direction"
            onChange={setDirection}
          />
        </View>
      ) : null}

      {step.damageTags?.length ? (
        <View style={styles.sectionCard}>
          <SelectDropdown
            label="Damage tags"
            options={[...step.damageTags]}
            selected={damageTags}
            multi
            placeholder="Select damage tags"
            onChange={setDamageTags}
          />
        </View>
      ) : null}

      {step.mode === 'build-notes' ? (
        <>
          <Text style={styles.label}>Build details</Text>
          <View style={styles.buildGrid}>
            {BUILD_NOTE_FIELDS.map((field) => (
              <View key={field} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field}</Text>
                <TextInput
                  style={[ui.input, styles.fieldInput]}
                  placeholder="—"
                  placeholderTextColor="#8A9AA3"
                  value={data.buildNotes.fields[field] ?? ''}
                  onChangeText={(text) =>
                    update({
                      buildNotes: {
                        ...data.buildNotes,
                        fields: { ...data.buildNotes.fields, [field]: text },
                      },
                    })
                  }
                />
              </View>
            ))}
          </View>
          {BUILD_NOTE_TEXT_KEYS.map((key) => (
            <View key={key} style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>{BUILD_NOTE_TEXT_LABELS[key]}</Text>
              <TextInput
                style={[ui.input, { height: 88, marginTop: 6 }]}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#8A9AA3"
                value={data.buildNotes.texts[key]}
                onChangeText={(text) =>
                  update({
                    buildNotes: {
                      ...data.buildNotes,
                      texts: { ...data.buildNotes.texts, [key]: text },
                    },
                  })
                }
              />
            </View>
          ))}
        </>
      ) : null}

      {(step.mode === 'fast' || step.mode === 'tagged' || step.mode === 'build-notes') && (
        <>
          <Text style={styles.label}>Photo label (optional)</Text>
          <TextInput
            style={ui.input}
            value={labelOverride}
            onChangeText={setLabelOverride}
            placeholder="Short label"
            placeholderTextColor="#8A9AA3"
          />
        </>
      )}

      <PhotoGrid
        photos={stepPhotos}
        onRemove={removePhoto}
        onSetCover={step.id === 'elevations' ? setCoverPhoto : undefined}
        showCover={step.id === 'elevations'}
        onReorder={reorderPhoto}
        onMove={promptMove}
        onAnnotate={openAnnotator}
      />

      <PhotoAnnotator
        visible={Boolean(annotatingPhoto)}
        uri={annotatingPhoto?.uri ?? ''}
        onClose={() => setAnnotatingPhoto(null)}
        onSaved={(uri) => {
          if (!annotatingPhoto) return;
          // Spec rule: annotations save as a copy — never alter the original photo.
          addPhotos([uri], {
            stepId: annotatingPhoto.stepId,
            label: `${annotatingPhoto.label} (annotated)`,
            component: annotatingPhoto.component,
            elevation: annotatingPhoto.elevation,
            roofDirection: annotatingPhoto.roofDirection,
            damageTags: [...annotatingPhoto.damageTags],
            notes: annotatingPhoto.notes,
            shotType: annotatingPhoto.shotType,
            isCover: false,
          });
          setAnnotatingPhoto(null);
        }}
      />

      <View style={{ marginTop: 24 }}>
        <PrimaryButton title={step.number === 10 ? 'Continue to Review' : 'Next Step'} onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 8 },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eyebrow: {
    color: '#C45C28',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  countPill: {
    backgroundColor: '#FFF1E8',
    borderColor: '#F0C9B0',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countPillActive: {
    backgroundColor: '#E17035',
    borderColor: '#E17035',
  },
  count: { color: '#9A4A1F', fontSize: 12, fontWeight: '800' },
  countActive: { color: '#FFFFFF' },
  label: { color: '#163A4A', fontSize: 14, fontWeight: '800', marginBottom: 10, marginTop: 18 },
  labelInCard: { color: '#163A4A', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E9EC',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C5D0D6',
    borderRadius: 12,
    borderWidth: 1.5,
    maxWidth: '100%',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: '#163A4A', borderColor: '#163A4A' },
  chipText: { color: '#3D5560', fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#FFFFFF' },
  quickBar: { flexDirection: 'row', gap: 10, marginTop: 18 },
  capture: {
    alignItems: 'center',
    backgroundColor: '#E17035',
    borderRadius: 14,
    flex: 1.2,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  captureText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  gallery: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#163A4A',
    borderRadius: 14,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  galleryText: { color: '#163A4A', fontSize: 15, fontWeight: '800' },
  another: {
    alignItems: 'center',
    backgroundColor: '#163A4A',
    borderRadius: 14,
    marginTop: 10,
    minHeight: 48,
    justifyContent: 'center',
    padding: 14,
  },
  anotherText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  empty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E0E4',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF3F5',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  emptyLens: {
    backgroundColor: '#FFFFFF',
    borderColor: '#84949C',
    borderRadius: 12,
    borderWidth: 2.5,
    height: 24,
    width: 24,
  },
  emptyTitle: { color: '#163A4A', fontSize: 17, fontWeight: '800' },
  emptyText: {
    color: '#526A74',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  photoWrap: { width: '47%' },
  photoTap: { position: 'relative' },
  photo: { borderRadius: 12, height: 130, width: '100%' },
  annotateBadge: {
    backgroundColor: 'rgba(22, 58, 74, 0.82)',
    borderRadius: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    right: 8,
  },
  annotateBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  caption: { color: '#3D5560', fontSize: 12, fontWeight: '600', marginTop: 6 },
  photoActions: { flexDirection: 'row', gap: 6, marginTop: 6 },
  miniBtn: {
    backgroundColor: '#EEF3F5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  miniDisabled: { opacity: 0.35 },
  miniText: { color: '#163A4A', fontSize: 11, fontWeight: '800' },
  coverLink: { color: '#C45C28', fontSize: 12, fontWeight: '800', marginTop: 4 },
  delete: { color: '#BD3C2D', fontSize: 13, fontWeight: '800', marginTop: 4 },
  listCard: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden' },
  listRow: {
    alignItems: 'center',
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  check: {
    alignItems: 'center',
    borderColor: '#D8E0E4',
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkOn: { backgroundColor: '#163A4A', borderColor: '#163A4A' },
  checkMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  listText: { color: '#163A4A', flex: 1, fontSize: 14, fontWeight: '600' },
  buildGrid: { gap: 4 },
  fieldRow: { marginBottom: 8 },
  fieldLabel: { color: '#3D5560', fontSize: 13, fontWeight: '700' },
  fieldInput: { marginTop: 6 },
  notesInput: { height: 88, marginTop: 0 },
  moveCard: {
    backgroundColor: '#FFF8F2',
    borderColor: '#F0D2C0',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  moveTitle: { color: '#163A4A', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  cancelMove: { alignItems: 'center', marginTop: 10 },
  cancelMoveText: { color: '#BD3C2D', fontWeight: '800' },
});
