import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ui } from '@/components/inspection-ui';
import { Brand } from '@/constants/theme';
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
};

function photoCaption(photo: PhotoItem) {
  const parts = [photo.label];
  if (photo.shotType && photo.shotType !== 'standard') parts.push(photo.shotType);
  if (photo.damageTags.length) parts.push(photo.damageTags.join(', '));
  if (photo.notes) parts.push(photo.notes);
  return parts.join(' · ');
}

function PhotoActionsMenu({
  photo,
  index,
  total,
  showCover,
  onRemove,
  onSetCover,
  onReorder,
  onMove,
  onAnnotate,
}: {
  photo: PhotoItem;
  index: number;
  total: number;
  showCover?: boolean;
  onRemove: (id: string) => void;
  onSetCover?: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onMove: (id: string) => void;
  onAnnotate?: (photo: PhotoItem) => void;
}) {
  const openMenu = () => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (onAnnotate) {
      buttons.push({ text: 'Mark damage', onPress: () => onAnnotate(photo) });
    }
    if (showCover && onSetCover && !photo.isCover) {
      buttons.push({ text: 'Set as cover', onPress: () => onSetCover(photo.id) });
    }
    if (index > 0) {
      buttons.push({ text: 'Move up', onPress: () => onReorder(photo.id, 'up') });
    }
    if (index < total - 1) {
      buttons.push({ text: 'Move down', onPress: () => onReorder(photo.id, 'down') });
    }
    buttons.push({ text: 'Move to step', onPress: () => onMove(photo.id) });
    buttons.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => onRemove(photo.id),
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(photo.label, 'Choose an action', buttons);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Photo options"
      hitSlop={8}
      onPress={openMenu}
      style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
    >
      <Ionicons color={Brand.muted} name="ellipsis-horizontal" size={18} />
    </Pressable>
  );
}

function OptionChipRow({
  items,
  selected,
  doneItems,
  onSelect,
  shortLabel,
}: {
  items: string[];
  selected: string;
  doneItems: Set<string>;
  onSelect: (item: string) => void;
  shortLabel?: (item: string) => string;
}) {
  const labelFor = shortLabel ?? ((item: string) => item);
  return (
    <View style={styles.slotChipWrap}>
      {items.map((item) => {
        const active = selected === item;
        const done = doneItems.has(item);
        return (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item)}
            style={[
              styles.slotChip,
              active && styles.slotChipActive,
              done && !active && styles.slotChipDone,
            ]}
          >
            {done ? (
              <Ionicons
                color={active ? Brand.surface : '#1D6B3F'}
                name="checkmark-circle"
                size={14}
                style={styles.slotChipIcon}
              />
            ) : null}
            <Text
              style={[styles.slotChipText, active && styles.slotChipTextActive]}
              numberOfLines={1}
            >
              {labelFor(item)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function shortSlotLabel(slot: string) {
  if (slot === 'Additional Elevations/Structures') return 'More';
  if (slot === 'Additional Roof Sections') return 'More';
  if (slot === 'Full Roof / Wide-Angle') return 'Wide';
  if (slot.length > 14) return slot.split(/[\s/]/)[0];
  return slot;
}

function SlotChipRow({
  slots,
  selected,
  doneSlots,
  onSelect,
}: {
  slots: string[];
  selected: string;
  doneSlots: Set<string>;
  onSelect: (slot: string) => void;
}) {
  return (
    <OptionChipRow
      items={slots}
      selected={selected}
      doneItems={doneSlots}
      onSelect={onSelect}
      shortLabel={shortSlotLabel}
    />
  );
}

function filteredPhotoCaption(photo: PhotoItem, compact = false) {
  if (compact) {
    const parts: string[] = [];
    const componentLabel = photo.component || photo.label.split(' (')[0];
    if (componentLabel) parts.push(componentLabel);
    if (photo.elevation) parts.push(photo.elevation);
    if (photo.damageTags.length) parts.push(photo.damageTags.join(', '));
    if (photo.shotType && photo.shotType !== 'standard') parts.push(photo.shotType);
    if (photo.notes) parts.push(photo.notes);
    return parts.join(' · ');
  }
  return photoCaption(photo);
}

function PhotoThumbnailGrid({
  photos,
  compactCaptions = false,
  minimal = false,
  onRemove,
  onSetCover,
  onReorder,
  onMove,
  onAnnotate,
  showCover,
}: {
  photos: PhotoItem[];
  compactCaptions?: boolean;
  minimal?: boolean;
  onRemove: (id: string) => void;
  onSetCover?: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onMove: (id: string) => void;
  onAnnotate?: (photo: PhotoItem) => void;
  showCover?: boolean;
}) {
  if (photos.length === 0) return null;

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
            {showCover && photo.isCover ? (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            ) : null}
            <View style={[styles.annotateBadge, minimal && styles.annotateBadgeMinimal]}>
              <Ionicons color="#FFFFFF" name="brush-outline" size={12} />
              {!minimal ? <Text style={styles.annotateBadgeText}>Mark</Text> : null}
            </View>
            {minimal ? (
              <View style={styles.photoMenuOverlay}>
                <PhotoActionsMenu
                  photo={photo}
                  index={index}
                  total={photos.length}
                  showCover={showCover}
                  onRemove={onRemove}
                  onSetCover={onSetCover}
                  onReorder={onReorder}
                  onMove={onMove}
                  onAnnotate={onAnnotate}
                />
              </View>
            ) : null}
          </Pressable>
          {!minimal ? (
            <View style={styles.photoMeta}>
              <Text style={styles.caption} numberOfLines={2}>
                {filteredPhotoCaption(photo, compactCaptions)}
              </Text>
              <PhotoActionsMenu
                photo={photo}
                index={index}
                total={photos.length}
                showCover={showCover}
                onRemove={onRemove}
                onSetCover={onSetCover}
                onReorder={onReorder}
                onMove={onMove}
                onAnnotate={onAnnotate}
              />
            </View>
          ) : null}
        </View>
          ))}
    </View>
  );
}

function ChipRow({
  options,
  selected,
  multi = false,
  compact = false,
  onChange,
}: {
  options: string[];
  selected: string | string[];
  multi?: boolean;
  compact?: boolean;
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
            style={[
              compact ? styles.slotChip : styles.chip,
              active && (compact ? styles.slotChipActive : styles.chipOn),
            ]}
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
            <Text
              style={[
                compact ? styles.slotChipText : styles.chipText,
                active && (compact ? styles.slotChipTextActive : styles.chipTextOn),
              ]}
              numberOfLines={1}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StepCapture({ step }: Props) {
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

  const doneSlots = useMemo(() => {
    if (step.mode !== 'slots') return new Set<string>();
    return new Set(stepPhotos.map((photo) => photo.label));
  }, [step.mode, stepPhotos]);

  const doneComponents = useMemo(() => {
    if (step.mode !== 'components' && step.mode !== 'metal') return new Set<string>();
    return new Set(
      stepPhotos
        .map((photo) => photo.component || photo.label.split(' (')[0])
        .filter(Boolean)
    );
  }, [step.mode, stepPhotos]);

  const visiblePhotos = useMemo(() => {
    if (step.mode === 'slots' && activeSlot) {
      return stepPhotos.filter((photo) => photo.label === activeSlot);
    }
    if ((step.mode === 'components' || step.mode === 'metal') && activeComponent) {
      return stepPhotos.filter(
        (photo) =>
          photo.component === activeComponent ||
          photo.label === activeComponent ||
          photo.label.startsWith(`${activeComponent} (`)
      );
    }
    return stepPhotos;
  }, [activeComponent, activeSlot, step.mode, stepPhotos]);

  const captureZoneTitle = useMemo(() => {
    if (step.mode === 'slots' && activeSlot) return `Capture ${activeSlot}`;
    if ((step.mode === 'components' || step.mode === 'metal') && activeComponent) {
      return `Capture ${activeComponent}`;
    }
    return 'Ready to capture';
  }, [activeComponent, activeSlot, step.mode]);

  const inlineTagsInCard =
    step.mode === 'components' || step.mode === 'metal' || step.mode === 'fast' || step.mode === 'tagged';

  const fillsViewport =
    step.mode === 'slots' ||
    step.mode === 'components' ||
    step.mode === 'metal' ||
    step.mode === 'fast' ||
    step.mode === 'tagged';

  useEffect(() => {
    setActiveSlot(step.slots?.[0] ?? '');
    setActiveComponent(step.components?.[0] ?? '');
    setElevation('');
    setDamageTags([]);
    setMetalShot('overview');
    setPhotoNotes('');
  }, [step.id, step.slots, step.components]);

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

    if (step.mode === 'slots' && step.slots && activeSlot) {
      const currentIndex = step.slots.indexOf(activeSlot);
      const nextEmpty = step.slots
        .slice(currentIndex + 1)
        .find((slot) => !stepPhotos.some((photo) => photo.label === slot));
      if (nextEmpty) setActiveSlot(nextEmpty);
    }

    if (
      (step.mode === 'components' || step.mode === 'metal') &&
      step.components &&
      activeComponent
    ) {
      const currentIndex = step.components.indexOf(activeComponent);
      const nextEmpty = step.components
        .slice(currentIndex + 1)
        .find(
          (component) =>
            !stepPhotos.some(
              (photo) =>
                photo.component === component ||
                photo.label === component ||
                photo.label.startsWith(`${component} (`)
            )
        );
      if (nextEmpty) setActiveComponent(nextEmpty);
    }

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

  const showTakeAnother =
    stepPhotos.length > 0 &&
    (step.mode === 'tagged' || step.mode === 'fast' || step.mode === 'metal');

  const compactCaptions = step.mode === 'components' || step.mode === 'metal';
  const isFormCaptureStep = step.mode === 'components' || step.mode === 'metal';

  const formDetails = isFormCaptureStep && step.components ? (
    <View style={styles.detailsPanel}>
      <SelectDropdown
        compact
        label="Component"
        options={step.components}
        selected={activeComponent}
        placeholder="Select component"
        onChange={setActiveComponent}
      />
      {step.locationTags?.length ? (
        <SelectDropdown
          compact
          label="Elevation"
          options={[...step.locationTags]}
          selected={elevation}
          placeholder="Select elevation"
          onChange={setElevation}
        />
      ) : null}
      {step.damageTags?.length ? (
        <SelectDropdown
          compact
          label="Damage tags"
          options={[...step.damageTags]}
          selected={damageTags}
          multi
          placeholder="Select damage tags"
          onChange={setDamageTags}
        />
      ) : null}
      {step.mode === 'metal' ? (
        <>
          <SelectDropdown
            compact
            label="Shot type"
            options={['overview', 'close-up']}
            selected={metalShot}
            placeholder="Select shot type"
            onChange={(value) => setMetalShot(value as 'overview' | 'close-up')}
          />
          <TextInput
            style={[ui.input, styles.notesInputCompact]}
            multiline
            textAlignVertical="top"
            placeholder="Notes (optional)"
            placeholderTextColor="#8A9AA3"
            value={photoNotes}
            onChangeText={setPhotoNotes}
          />
        </>
      ) : null}
    </View>
  ) : null;

  const captureButtons = (
    <View style={styles.quickBar}>
      <Pressable style={styles.capture} onPress={() => void capture(true)}>
        <Ionicons color={Brand.surface} name="camera" size={18} />
        <Text style={styles.captureText}>Take Photo</Text>
      </Pressable>
      <Pressable style={styles.gallery} onPress={() => void capture(false, true)}>
        <Text style={styles.galleryText}>Upload</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, fillsViewport && styles.rootFill]}>
      <View style={[styles.stepCard, fillsViewport && styles.stepCardFill]}>
        {isFormCaptureStep ? (
          <>
            {formDetails}
            {captureButtons}
            {step.components && stepPhotos.length > 0 ? (
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  {doneComponents.size} of {step.components.length} components
                </Text>
              </View>
            ) : null}
            {stepPhotos.length > 0 ? (
              <View style={styles.gallerySection}>
                <View style={styles.galleryHeader}>
                  <Text style={styles.galleryTitle}>Captured photos</Text>
                  <Text style={styles.galleryCount}>{stepPhotos.length}</Text>
                </View>
                <PhotoThumbnailGrid
                  photos={stepPhotos}
                  compactCaptions={compactCaptions}
                  onRemove={removePhoto}
                  onSetCover={step.id === 'elevations' ? setCoverPhoto : undefined}
                  showCover={step.id === 'elevations'}
                  onReorder={reorderPhoto}
                  onMove={promptMove}
                  onAnnotate={openAnnotator}
                />
              </View>
            ) : null}
          </>
        ) : (
          <>
        <Text style={styles.stepSubtitle}>{step.subtitle}</Text>

        {step.mode === 'slots' && step.slots ? (
          <SlotChipRow
            slots={step.slots}
            selected={activeSlot}
            doneSlots={doneSlots}
            onSelect={setActiveSlot}
          />
        ) : null}

        {inlineTagsInCard && step.locationTags?.length ? (
          <View style={styles.tagSection}>
            <Text style={styles.tagLabel}>Elevation</Text>
            <ChipRow
              compact
              options={[...step.locationTags]}
              selected={elevation}
              onChange={(value) => setElevation(value as string)}
            />
          </View>
        ) : null}

        {inlineTagsInCard && step.directionTags?.length ? (
          <View style={styles.tagSection}>
            <Text style={styles.tagLabel}>Roof direction</Text>
            <ChipRow
              compact
              options={[...step.directionTags]}
              selected={direction}
              onChange={(value) => setDirection(value as string)}
            />
          </View>
        ) : null}

        {inlineTagsInCard && step.damageTags?.length ? (
          <View style={styles.tagSection}>
            <Text style={styles.tagLabel}>Damage tags</Text>
            <ChipRow
              compact
              multi
              options={[...step.damageTags]}
              selected={damageTags}
              onChange={(value) => setDamageTags(value as string[])}
            />
          </View>
        ) : null}

        <View
          style={[
            styles.mediaArea,
            fillsViewport && visiblePhotos.length === 0 && styles.mediaAreaFill,
          ]}
        >
          {visiblePhotos.length === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={captureZoneTitle}
              onPress={() => void capture(true)}
              style={({ pressed }) => [styles.captureZone, pressed && styles.captureZonePressed]}
            >
              <View style={styles.captureZoneIcon}>
                <Ionicons color={Brand.soft} name="camera-outline" size={28} />
              </View>
              <Text style={styles.captureZoneTitle}>{captureZoneTitle}</Text>
              <Text style={styles.captureZoneHint}>Tap here or use the button below</Text>
            </Pressable>
          ) : (
            <PhotoThumbnailGrid
              photos={visiblePhotos}
              compactCaptions={compactCaptions}
              onRemove={removePhoto}
              onSetCover={step.id === 'elevations' ? setCoverPhoto : undefined}
              showCover={step.id === 'elevations'}
              onReorder={reorderPhoto}
              onMove={promptMove}
              onAnnotate={openAnnotator}
            />
          )}
        </View>

        <View style={styles.quickBar}>
          <Pressable style={styles.capture} onPress={() => void capture(true)}>
            <Ionicons color={Brand.surface} name="camera" size={18} />
            <Text style={styles.captureText}>Take Photo</Text>
          </Pressable>
          <Pressable style={styles.gallery} onPress={() => void capture(false, true)}>
            <Text style={styles.galleryText}>Upload</Text>
          </Pressable>
        </View>

        {showTakeAnother ? (
          <Pressable style={styles.another} onPress={() => void capture(true)}>
            <Text style={styles.anotherText}>Take another photo</Text>
          </Pressable>
        ) : null}

        {step.mode === 'slots' && stepPhotos.length > 0 ? (
          <Text style={styles.slotProgress}>
            {doneSlots.size} of {step.slots?.length ?? 0} sides captured
          </Text>
        ) : null}
          </>
        )}
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

      {step.locationTags?.length && !inlineTagsInCard ? (
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

      {step.directionTags?.length && !inlineTagsInCard ? (
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

      {step.damageTags?.length && !inlineTagsInCard ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
  },
  rootFill: {
    flex: 1,
  },
  stepCard: {
    backgroundColor: Brand.surface,
    borderColor: '#E2E9EC',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 6,
    padding: 18,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  stepCardFill: {
    flex: 1,
  },
  stepSubtitle: {
    color: Brand.muted,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  slotChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  slotChip: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderColor: Brand.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotChipActive: {
    backgroundColor: Brand.ink,
    borderColor: Brand.ink,
  },
  slotChipDone: {
    backgroundColor: '#EDF7F1',
    borderColor: '#B8DFC9',
  },
  slotChipIcon: {
    marginRight: 4,
  },
  slotChipText: {
    color: Brand.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  slotChipTextActive: {
    color: Brand.surface,
  },
  inlineField: {
    marginTop: 14,
  },
  tagSection: {
    marginTop: 14,
  },
  dropdownGroup: {
    gap: 12,
    marginTop: 14,
  },
  detailsPanel: {
    backgroundColor: Brand.background,
    borderRadius: 14,
    gap: 10,
    padding: 14,
  },
  notesInputCompact: {
    height: 72,
    marginTop: 0,
  },
  progressRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  progressText: {
    backgroundColor: Brand.background,
    borderRadius: 20,
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  gallerySection: {
    borderTopColor: Brand.border,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
  },
  galleryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  galleryTitle: {
    color: Brand.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  galleryCount: {
    backgroundColor: Brand.background,
    borderRadius: 12,
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagLabel: {
    color: Brand.soft,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  mediaArea: {
    marginTop: 14,
  },
  mediaAreaFill: {
    flex: 1,
    minHeight: 160,
  },
  captureZone: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderColor: '#E2E9EC',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 180,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  captureZonePressed: {
    opacity: 0.85,
  },
  captureZoneIcon: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    marginBottom: 12,
    width: 64,
  },
  captureZoneTitle: {
    color: Brand.ink,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  captureZoneHint: {
    color: Brand.soft,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  slotProgress: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  label: { color: '#133A42', fontSize: 14, fontWeight: '800', marginBottom: 10, marginTop: 18 },
  labelInCard: { color: '#133A42', fontSize: 14, fontWeight: '800', marginBottom: 12 },
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
  chipOn: { backgroundColor: '#133A42', borderColor: '#133A42' },
  chipText: { color: '#3D5560', fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#FFFFFF' },
  quickBar: { flexDirection: 'row', gap: 10, marginTop: 14 },
  capture: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadius,
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  captureText: { color: Brand.surface, fontSize: 15, fontWeight: '700' },
  gallery: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: Brand.buttonRadius,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  galleryText: { color: Brand.muted, fontSize: 15, fontWeight: '600' },
  another: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  anotherText: { color: Brand.muted, fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: '47.5%' },
  photoTap: { position: 'relative' },
  photo: {
    backgroundColor: '#EEF3F5',
    borderColor: '#E2E9EC',
    borderRadius: 12,
    borderWidth: 1,
    height: 132,
    width: '100%',
  },
  coverBadge: {
    backgroundColor: Brand.accent,
    borderRadius: 6,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
  },
  coverBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  annotateBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(27, 67, 50, 0.82)',
    borderRadius: 8,
    bottom: 8,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    right: 8,
  },
  annotateBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  annotateBadgeMinimal: {
    bottom: 8,
    left: 8,
    right: undefined,
  },
  photoMenuOverlay: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
  photoMeta: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  caption: { color: '#3D5560', flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 16 },
  menuBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  menuBtnPressed: { opacity: 0.7 },
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
  checkOn: { backgroundColor: '#133A42', borderColor: '#133A42' },
  checkMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  listText: { color: '#133A42', flex: 1, fontSize: 14, fontWeight: '600' },
  buildGrid: { gap: 4 },
  fieldRow: { marginBottom: 8 },
  fieldLabel: { color: '#3D5560', fontSize: 13, fontWeight: '700' },
  fieldInput: { marginTop: 6 },
  notesInput: { height: 88, marginTop: 0 },
  moveCard: {
    backgroundColor: Brand.accentLight,
    borderColor: '#F0D2C0',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  moveTitle: { color: '#133A42', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  cancelMove: { alignItems: 'center', marginTop: 10 },
  cancelMoveText: { color: '#BD3C2D', fontWeight: '800' },
});
