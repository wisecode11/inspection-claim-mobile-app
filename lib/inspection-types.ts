import type { PhotoItem, StepId, BuildNoteTextKey } from '@/lib/capture-steps';
import type { WeatherSummary } from '@/lib/api';

export type BuildNotesData = {
  fields: Record<string, string>;
  texts: Record<BuildNoteTextKey, string>;
  selectedTieIns: string[];
};

export type InspectionData = {
  jobId: string;
  customer: string;
  address: string;
  date: string;
  jobStatus: string;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  geocodeError: string;

  homeownerName: string;
  inspectorName: string;
  phone: string;
  email: string;
  claimNumber: string;
  policyNumber: string;
  dateOfLoss: string | null;
  estimatedRoofAge: string;

  photos: PhotoItem[];
  completedSteps: StepId[];
  currentStepId: StepId;
  buildNotes: BuildNotesData;
  lastRoofDirection: string;

  weatherStatus: string;
  weatherMatchStatus: string | null;
  weatherSummary: WeatherSummary | null;
};

export type JobSeed = Pick<
  InspectionData,
  | 'jobId'
  | 'customer'
  | 'address'
  | 'date'
  | 'jobStatus'
  | 'latitude'
  | 'longitude'
  | 'locationConfirmed'
  | 'geocodeError'
  | 'dateOfLoss'
  | 'claimNumber'
  | 'policyNumber'
  | 'phone'
  | 'email'
>;

export function emptyBuildNotes(): BuildNotesData {
  return {
    fields: {},
    texts: {
      roofConstruction: '',
      specialConditions: '',
      accessSetup: '',
      additionalBuildNotes: '',
    },
    selectedTieIns: [],
  };
}

export function createInitialInspection(overrides: Partial<InspectionData> = {}): InspectionData {
  return {
    jobId: '',
    customer: '',
    address: '',
    date: '',
    jobStatus: '',
    latitude: null,
    longitude: null,
    locationConfirmed: false,
    geocodeError: '',
    homeownerName: '',
    inspectorName: '',
    phone: '',
    email: '',
    claimNumber: '',
    policyNumber: '',
    dateOfLoss: null,
    estimatedRoofAge: '',
    photos: [],
    completedSteps: [],
    currentStepId: 'elevations',
    buildNotes: emptyBuildNotes(),
    lastRoofDirection: '',
    weatherStatus: '',
    weatherMatchStatus: null,
    weatherSummary: null,
    ...overrides,
  };
}
