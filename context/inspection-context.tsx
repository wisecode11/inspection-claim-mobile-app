import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  createPhotoId,
  PhotoItem,
  StepId,
} from '@/lib/capture-steps';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft-storage';
import {
  createInitialInspection,
  emptyBuildNotes,
  InspectionData,
  JobSeed,
} from '@/lib/inspection-types';

export type { InspectionData, JobSeed } from '@/lib/inspection-types';

type InspectionContextValue = {
  data: InspectionData;
  update: (changes: Partial<InspectionData>) => void;
  resetForJob: (job: JobSeed) => void;
  addPhotos: (uris: string[], meta: Omit<PhotoItem, 'id' | 'uri' | 'createdAt' | 'damageTags'> & { damageTags?: string[] }) => void;
  updatePhoto: (id: string, changes: Partial<PhotoItem>) => void;
  removePhoto: (id: string) => void;
  reorderPhoto: (id: string, direction: 'up' | 'down') => void;
  movePhotoToStep: (id: string, stepId: StepId, label?: string) => void;
  markStepComplete: (stepId: StepId) => void;
  setCoverPhoto: (id: string) => void;
  clearInspectionDraft: () => Promise<void>;
};

const InspectionContext = createContext<InspectionContextValue | null>(null);

export function InspectionProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<InspectionData>(createInitialInspection());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!data.jobId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDraft(data.jobId, data);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data]);

  const update = useCallback((changes: Partial<InspectionData>) => {
    setData((current) => ({ ...current, ...changes }));
  }, []);

  const resetForJob = useCallback((job: JobSeed) => {
    const base = createInitialInspection({
      ...job,
      homeownerName: job.customer,
      claimNumber: job.claimNumber || '',
      policyNumber: job.policyNumber || '',
      phone: job.phone || '',
      email: job.email || '',
      photos: [],
      completedSteps: [],
      currentStepId: 'elevations',
      buildNotes: emptyBuildNotes(),
    });

    setData(base);

    void loadDraft(job.jobId).then((draft) => {
      if (!draft || draft.jobId !== job.jobId) return;
      setData({
        ...draft,
        ...job,
        homeownerName: draft.homeownerName || job.customer,
        claimNumber: job.claimNumber || draft.claimNumber || '',
        policyNumber: job.policyNumber || draft.policyNumber || '',
        phone: job.phone || draft.phone || '',
        email: job.email || draft.email || '',
        photos: Array.isArray(draft.photos) ? draft.photos : [],
        completedSteps: Array.isArray(draft.completedSteps) ? draft.completedSteps : [],
        buildNotes: draft.buildNotes ?? emptyBuildNotes(),
      });
    });
  }, []);

  const addPhotos = useCallback(
    (
      uris: string[],
      meta: Omit<PhotoItem, 'id' | 'uri' | 'createdAt' | 'damageTags'> & { damageTags?: string[] }
    ) => {
      setData((current) => {
        const isFirstFront =
          meta.stepId === 'elevations' &&
          meta.label === 'Front' &&
          !current.photos.some((photo) => photo.isCover);

        const nextPhotos = [
          ...current.photos,
          ...uris.map((uri, index) => ({
            id: createPhotoId(),
            uri,
            stepId: meta.stepId,
            label: meta.label,
            component: meta.component,
            elevation: meta.elevation,
            roofDirection: meta.roofDirection,
            damageTags: meta.damageTags ?? [],
            notes: meta.notes,
            shotType: meta.shotType ?? 'standard',
            isCover: Boolean(meta.isCover) || (isFirstFront && index === 0),
            createdAt: new Date().toISOString(),
          })),
        ];

        return {
          ...current,
          photos: nextPhotos,
          lastRoofDirection: meta.roofDirection || current.lastRoofDirection,
        };
      });
    },
    []
  );

  const updatePhoto = useCallback((id: string, changes: Partial<PhotoItem>) => {
    setData((current) => ({
      ...current,
      photos: current.photos.map((photo) => (photo.id === id ? { ...photo, ...changes } : photo)),
      lastRoofDirection: changes.roofDirection || current.lastRoofDirection,
    }));
  }, []);

  const removePhoto = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.id !== id),
    }));
  }, []);

  const reorderPhoto = useCallback((id: string, direction: 'up' | 'down') => {
    setData((current) => {
      const index = current.photos.findIndex((photo) => photo.id === id);
      if (index < 0) return current;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.photos.length) return current;

      // Only swap within the same step so order stays meaningful in the grid.
      if (current.photos[index].stepId !== current.photos[target].stepId) {
        const stepPhotos = current.photos
          .map((photo, photoIndex) => ({ photo, photoIndex }))
          .filter((entry) => entry.photo.stepId === current.photos[index].stepId);
        const localIndex = stepPhotos.findIndex((entry) => entry.photo.id === id);
        const localTarget = direction === 'up' ? localIndex - 1 : localIndex + 1;
        if (localTarget < 0 || localTarget >= stepPhotos.length) return current;
        const from = stepPhotos[localIndex].photoIndex;
        const to = stepPhotos[localTarget].photoIndex;
        const next = [...current.photos];
        const tmp = next[from];
        next[from] = next[to];
        next[to] = tmp;
        return { ...current, photos: next };
      }

      const next = [...current.photos];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return { ...current, photos: next };
    });
  }, []);

  const movePhotoToStep = useCallback((id: string, stepId: StepId, label?: string) => {
    setData((current) => ({
      ...current,
      photos: current.photos.map((photo) =>
        photo.id === id
          ? {
              ...photo,
              stepId,
              label: label || photo.label,
              isCover: stepId === 'elevations' ? photo.isCover : false,
            }
          : photo
      ),
    }));
  }, []);

  const markStepComplete = useCallback((stepId: StepId) => {
    setData((current) => ({
      ...current,
      completedSteps: current.completedSteps.includes(stepId)
        ? current.completedSteps
        : [...current.completedSteps, stepId],
      currentStepId: stepId,
    }));
  }, []);

  const setCoverPhoto = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      photos: current.photos.map((photo) => ({ ...photo, isCover: photo.id === id })),
    }));
  }, []);

  const clearInspectionDraft = useCallback(async () => {
    const jobId = dataRef.current.jobId;
    await clearDraft(jobId);
  }, []);

  return (
    <InspectionContext.Provider
      value={{
        data,
        update,
        resetForJob,
        addPhotos,
        updatePhoto,
        removePhoto,
        reorderPhoto,
        movePhotoToStep,
        markStepComplete,
        setCoverPhoto,
        clearInspectionDraft,
      }}
    >
      {children}
    </InspectionContext.Provider>
  );
}

export function useInspection() {
  const value = useContext(InspectionContext);
  if (!value) throw new Error('useInspection must be used inside InspectionProvider');
  return value;
}
