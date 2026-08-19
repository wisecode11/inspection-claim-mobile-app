import { createContext, PropsWithChildren, useContext, useState } from 'react';

type InspectionData = {
  jobId: string;
  customer: string;
  address: string;
  date: string;
  jobStatus: string;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  geocodeError: string;
  roofSlope: string;
  roofType: string;
  roofCondition: string;
  roofNotes: string;
  photos: string[];
  hailArea: string;
  hailSize: string;
  hailImpacts: string;
  hailNotes: string;
  damageType: string;
  damageLocation: string;
  damageSeverity: string;
  damageNotes: string;
  collateralDamage: string[];
  weatherStatus: string;
};

const initialData: InspectionData = {
  jobId: '',
  customer: 'Michael Anderson',
  address: '1842 Oak Ridge Drive, Austin, TX',
  date: 'August 17, 2026',
  jobStatus: 'Scheduled',
  latitude: 30.2672,
  longitude: -97.7431,
  locationConfirmed: false,
  geocodeError: '',
  roofSlope: 'Front',
  roofType: 'Asphalt Shingle',
  roofCondition: 'Damaged',
  roofNotes: '',
  photos: [],
  hailArea: '100',
  hailSize: '1 inch',
  hailImpacts: '12',
  hailNotes: '',
  damageType: 'Hail',
  damageLocation: 'Front Slope',
  damageSeverity: 'Moderate',
  damageNotes: '',
  collateralDamage: [],
  weatherStatus: 'Storm Detected',
};

type InspectionContextValue = {
  data: InspectionData;
  update: (changes: Partial<InspectionData>) => void;
  resetForJob: (
    job: Pick<
      InspectionData,
      'jobId' | 'customer' | 'address' | 'date' | 'jobStatus' | 'latitude' | 'longitude' | 'locationConfirmed' | 'geocodeError'
    >
  ) => void;
};

const InspectionContext = createContext<InspectionContextValue | null>(null);

export function InspectionProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState(initialData);

  const update = (changes: Partial<InspectionData>) => {
    setData((current) => ({ ...current, ...changes }));
  };

  const resetForJob = (
    job: Pick<
      InspectionData,
      'jobId' | 'customer' | 'address' | 'date' | 'jobStatus' | 'latitude' | 'longitude' | 'locationConfirmed' | 'geocodeError'
    >
  ) => {
    setData({ ...initialData, ...job, photos: [], collateralDamage: [] });
  };

  return <InspectionContext.Provider value={{ data, update, resetForJob }}>{children}</InspectionContext.Provider>;
}

export function useInspection() {
  const value = useContext(InspectionContext);
  if (!value) throw new Error('useInspection must be used inside InspectionProvider');
  return value;
}
