export type StepId =
  | 'elevations'
  | 'collateral'
  | 'spatter'
  | 'metal'
  | 'shingles'
  | 'test-squares'
  | 'wear-tear'
  | 'tie-ins'
  | 'roof-overviews'
  | 'build-notes';

export type EvidenceSectionId =
  | 'elevations'
  | 'collateral'
  | 'spatter'
  | 'metal'
  | 'shingles'
  | 'test-squares'
  | 'wear-tear'
  | 'tie-ins'
  | 'roof-overviews'
  | 'build-notes'
  | 'hail-bruising';

export type CaptureMode = 'slots' | 'components' | 'fast' | 'metal' | 'tagged' | 'checklist' | 'build-notes';

export type CaptureStep = {
  id: StepId;
  number: number;
  title: string;
  subtitle: string;
  mode: CaptureMode;
  slots?: string[];
  components?: string[];
  damageTags?: string[];
  locationTags?: string[];
  directionTags?: string[];
  suggestedGaps?: string[];
};

export const ELEVATION_TAGS = ['Front', 'Right', 'Rear', 'Left', 'Roof', 'Other'] as const;
export const ROOF_DIRECTIONS = ['North', 'South', 'East', 'West', 'Other'] as const;

export const CAPTURE_STEPS: CaptureStep[] = [
  {
    id: 'elevations',
    number: 1,
    title: 'Elevations',
    subtitle: 'Capture four sides plus any additional structures.',
    mode: 'slots',
    slots: ['Front', 'Right', 'Rear', 'Left', 'Additional Elevations/Structures'],
    suggestedGaps: ['Front', 'Right', 'Rear', 'Left'],
  },
  {
    id: 'collateral',
    number: 2,
    title: 'Collateral Damage',
    subtitle: 'Select a component, then capture photos with elevation and damage tags.',
    mode: 'components',
    components: [
      'Downspouts',
      'Window Screens',
      'Metal Fascia',
      'Siding',
      'Garage Doors',
      'AC Condenser / HVAC Fins',
      'Fences',
      'Decks',
      'Railings',
      'Satellite Dishes',
      'Gutter Guards / Gutter Helmets',
      'Gutter Toppers',
      'Skylights',
      'Other',
    ],
    locationTags: [...ELEVATION_TAGS],
    damageTags: [
      'Hail Dents',
      'Hail Dents to HVAC',
      'Wind Damage',
      'Impact Damage',
      'Cosmetic Only',
      'Other',
    ],
  },
  {
    id: 'spatter',
    number: 3,
    title: 'Spatter',
    subtitle: 'Fast capture of visible spatter. Location tags only — no material select.',
    mode: 'fast',
    locationTags: [...ELEVATION_TAGS],
  },
  {
    id: 'metal',
    number: 4,
    title: 'Hail Impacts: Metal',
    subtitle: 'Overview then close-up for each metal component.',
    mode: 'metal',
    components: [
      'Metal Roof',
      'Metal Porch Roof',
      'Bay Window Metal Roof',
      'Metal Cornice Return',
      'Other Metal Roofing / Component',
    ],
    locationTags: [...ELEVATION_TAGS],
  },
  {
    id: 'shingles',
    number: 5,
    title: 'Hail Impacts: Shingles',
    subtitle: 'Tag damage types and roof direction, then take another quickly.',
    mode: 'tagged',
    damageTags: [
      'Hail Bruising',
      'Granule Displacement',
      'Exposed Asphalt',
      'Mat Fracture',
      'Cracking',
      'Other',
    ],
    directionTags: [...ROOF_DIRECTIONS],
  },
  {
    id: 'test-squares',
    number: 6,
    title: 'Test Squares',
    subtitle: 'Capture test-square photos for each roof direction.',
    mode: 'slots',
    slots: ['North', 'South', 'East', 'West'],
    suggestedGaps: ['North', 'South', 'East', 'West'],
  },
  {
    id: 'wear-tear',
    number: 7,
    title: 'Wear & Tear',
    subtitle: 'Document common wear conditions.',
    mode: 'tagged',
    damageTags: ['Excessive Granule Loss', 'Blistering', 'Other'],
  },
  {
    id: 'tie-ins',
    number: 8,
    title: 'Roof Tie-Ins',
    subtitle: 'Mark transition points and attach supporting photos.',
    mode: 'checklist',
    components: [
      'Connected Slopes',
      'Upper/Lower Slope Relationships',
      'Valleys',
      'Intersecting Roof Sections',
      'Slopes terminating into others',
      'Sections that cannot be separated',
    ],
  },
  {
    id: 'roof-overviews',
    number: 9,
    title: 'Roof Overviews',
    subtitle: 'Wide and directional roof overview photos.',
    mode: 'slots',
    slots: ['Front', 'Right', 'Rear', 'Left', 'Ridge', 'Full Roof / Wide-Angle', 'Additional Roof Sections'],
    suggestedGaps: ['Front', 'Right', 'Rear', 'Left', 'Ridge', 'Full Roof / Wide-Angle'],
  },
  {
    id: 'build-notes',
    number: 10,
    title: 'Build Notes',
    subtitle: 'Structured roof facts, free-text notes, and supporting photos.',
    mode: 'build-notes',
  },
];

export const BUILD_NOTE_FIELDS = [
  'Stories',
  'Roof Pitch',
  'Shingle Type',
  'Layers',
  'Ridge Vent',
  'Box Vents',
  'Pipe Boots',
  'Skylights',
  'Chimneys',
  'Gutters',
  'Gutter Guards',
  'Satellite Dish',
  'Solar Panels',
  'Other',
] as const;

export const BUILD_NOTE_TEXT_KEYS = [
  'roofConstruction',
  'specialConditions',
  'accessSetup',
  'additionalBuildNotes',
] as const;

export type BuildNoteTextKey = (typeof BUILD_NOTE_TEXT_KEYS)[number];

export const BUILD_NOTE_TEXT_LABELS: Record<BuildNoteTextKey, string> = {
  roofConstruction: 'Roof Construction',
  specialConditions: 'Special Conditions',
  accessSetup: 'Access / Setup',
  additionalBuildNotes: 'Additional Build Notes',
};

export function getStepById(id: string | undefined): CaptureStep | undefined {
  return CAPTURE_STEPS.find((step) => step.id === id);
}

export function getStepByNumber(number: number): CaptureStep | undefined {
  return CAPTURE_STEPS.find((step) => step.number === number);
}

export function nextStepId(current: StepId): StepId | 'review' {
  const index = CAPTURE_STEPS.findIndex((step) => step.id === current);
  if (index < 0 || index >= CAPTURE_STEPS.length - 1) return 'review';
  return CAPTURE_STEPS[index + 1].id;
}

export function prevStepId(current: StepId): StepId | 'setup' {
  const index = CAPTURE_STEPS.findIndex((step) => step.id === current);
  if (index <= 0) return 'setup';
  return CAPTURE_STEPS[index - 1].id;
}

export type PhotoAnnotation = {
  id: string;
  shape: 'circle' | 'arrow' | 'draw' | 'text';
  /** Normalized 0–1 relative to the image box (optional legacy support) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: { x: number; y: number }[];
  text?: string;
};

export type PhotoItem = {
  id: string;
  uri: string;
  stepId: StepId;
  label: string;
  component?: string;
  elevation?: string;
  roofDirection?: string;
  damageTags: string[];
  notes?: string;
  shotType?: 'overview' | 'close-up' | 'standard';
  isCover?: boolean;
  annotations?: PhotoAnnotation[];
  createdAt: string;
};

export function routePhotoToSection(photo: PhotoItem): EvidenceSectionId {
  if (photo.stepId === 'shingles' && photo.damageTags.includes('Hail Bruising')) {
    return 'hail-bruising';
  }
  return photo.stepId;
}

export function sectionTitle(sectionId: EvidenceSectionId): string {
  const titles: Record<EvidenceSectionId, string> = {
    elevations: 'Elevations',
    collateral: 'Collateral Damage',
    spatter: 'Spatter',
    metal: 'Hail Impacts - Metal',
    shingles: 'Hail Impacts - Shingles',
    'test-squares': 'Test Squares',
    'wear-tear': 'Wear & Tear',
    'tie-ins': 'Roof Tie-ins',
    'roof-overviews': 'Roof Overviews',
    'build-notes': 'Build Notes',
    'hail-bruising': 'Roof - Hail Bruising',
  };
  return titles[sectionId];
}

export const EVIDENCE_SECTION_ORDER: EvidenceSectionId[] = [
  'elevations',
  'collateral',
  'spatter',
  'metal',
  'shingles',
  'hail-bruising',
  'test-squares',
  'wear-tear',
  'tie-ins',
  'roof-overviews',
  'build-notes',
];

export function createPhotoId() {
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
