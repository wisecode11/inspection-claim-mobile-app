import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { loadSession, saveSession } from '@/lib/auth-storage';
import type { InspectionData } from '@/lib/inspection-types';
import { readPhotoBase64 } from '@/lib/photo-storage';
import type { ReportLanguagePackage } from '@/lib/report-templates';

const API_PORT = 8000;

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  companyId: string | null;
  profile: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    licenseNumber?: string;
  };
};

export type AuthCompany = {
  id: string;
  name: string;
  legalName?: string;
  branding?: {
    companyDisplayName?: string;
  };
};

export type LoginResult = {
  user: AuthUser;
  company: AuthCompany | null;
  token: string;
  refreshToken: string | null;
};

type AuthTokens = {
  accessToken?: string;
  refreshToken?: string;
};

type LoginApiData = {
  user?: AuthUser;
  company?: AuthCompany | null;
  token?: string;
  tokens?: AuthTokens;
};

export type JobAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  formatted?: string;
};

export type JobCustomer = {
  _id?: string;
  name?: string;
  phone?: string;
  email?: string;
};

export type JobGeocode = {
  status?: string;
  provider?: string;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string;
  confirmed?: boolean;
  confirmedAt?: string | null;
  error?: string;
};

export type InspectionJob = {
  id: string;
  jobNumber?: string;
  status: string;
  type?: string;
  notes?: string;
  createdAt?: string;
  scheduledAt?: string | null;
  dateOfLoss?: string | null;
  claim?: {
    dateOfLoss?: string | null;
    claimNumber?: string;
    policyNumber?: string;
    insuranceCompany?: string;
    status?: string;
  };
  customer: JobCustomer | null;
  address?: JobAddress | null;
  geocode?: JobGeocode | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type WeatherSummary = {
  badgeTitle: string;
  badgeSub: string;
  stormDate: string;
  weather: string;
  hail: string;
  wind: string;
  rain: string;
  stormMatch: string;
};

export type WeatherVerification = {
  id: string;
  jobId: string;
  matchStatus: 'match' | 'mismatch' | 'inconclusive' | 'no_data';
  dateOfLoss?: string;
  summary: WeatherSummary;
};

export type SubmitPackageResult = {
  job?: InspectionJob;
  report?: {
    id: string;
    status: string;
    pdfStatus?: string;
    pdfUrl?: string;
  };
  photosUploaded?: number;
  alreadySubmitted?: boolean;
};

type ApiErrorBody = {
  success?: boolean;
  message?: string;
};

type RequestOptions = RequestInit & {
  token?: string;
  skipAuthRetry?: boolean;
};

function lanHostFromExpo(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const match = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }

  let host = lanHostFromExpo();
  if (!host || host === '127.0.0.1') {
    host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  }

  return `http://${host}:${API_PORT}`;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const session = await loadSession();
    if (!session.refreshToken) return null;

    try {
      const payload = await requestJson<{ data?: LoginApiData }>(
        '/api/auth/refresh',
        {
          method: 'POST',
          skipAuthRetry: true,
          body: JSON.stringify({
            refreshToken: session.refreshToken,
            platform: Platform.OS,
          }),
        }
      );

      const accessToken = payload.data?.tokens?.accessToken || payload.data?.token;
      const nextRefresh = payload.data?.tokens?.refreshToken || session.refreshToken;
      if (!accessToken) return null;

      await saveSession({
        token: accessToken,
        refreshToken: nextRefresh || null,
        user: session.user,
        company: session.company,
      });
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, skipAuthRetry, ...rest } = options;
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new Error('Cannot reach the server. Make sure the backend is running.');
  }

  if (response.status === 401 && token && !skipAuthRetry) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return requestJson<T>(path, { ...options, token: nextToken, skipAuthRetry: true });
    }
  }

  const payload = (await response.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!response.ok || !payload) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && payload.message
        ? String(payload.message)
        : 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function loginWithApi(email: string, password: string): Promise<LoginResult> {
  const payload = await requestJson<{ data?: LoginApiData }>('/api/auth/login', {
    method: 'POST',
    skipAuthRetry: true,
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      platform: Platform.OS,
    }),
  });

  const user = payload.data?.user;
  const company = payload.data?.company ?? null;
  const token = payload.data?.tokens?.accessToken || payload.data?.token;
  const refreshToken = payload.data?.tokens?.refreshToken || null;
  if (!user || !token) {
    throw new Error('Login failed');
  }

  if (user.role !== 'inspector') {
    throw new Error('This app is for inspectors. Use the web dashboard for this account.');
  }

  return { user, company, token, refreshToken };
}

export async function fetchJobs(token: string): Promise<InspectionJob[]> {
  const payload = await requestJson<{ data?: { jobs?: InspectionJob[] } }>('/api/jobs', {
    token,
  });

  return payload.data?.jobs ?? [];
}

export async function fetchJob(token: string, jobId: string): Promise<InspectionJob> {
  const payload = await requestJson<{ data?: { job?: InspectionJob } }>(`/api/jobs/${jobId}`, {
    token,
  });
  if (!payload.data?.job) {
    throw new Error('Job not found');
  }
  return payload.data.job;
}

export async function acceptJob(token: string, jobId: string): Promise<InspectionJob> {
  const payload = await requestJson<{ data?: { job?: InspectionJob } }>(`/api/jobs/${jobId}/accept`, {
    method: 'POST',
    token,
  });
  if (!payload.data?.job) {
    throw new Error('Could not start job');
  }
  return payload.data.job;
}

export async function confirmJobLocation(
  token: string,
  jobId: string,
  coords: { latitude: number; longitude: number }
): Promise<InspectionJob> {
  const payload = await requestJson<{ data?: { job?: InspectionJob } }>(`/api/jobs/${jobId}/location`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(coords),
  });

  if (!payload.data?.job) {
    throw new Error('Could not confirm location');
  }

  return payload.data.job;
}

export async function fetchWeatherVerification(
  token: string,
  jobId: string
): Promise<WeatherVerification> {
  const payload = await requestJson<{ data?: { weather?: WeatherVerification } }>(
    `/api/weather/jobs/${jobId}`,
    { token }
  );

  if (!payload.data?.weather?.summary) {
    throw new Error('Weather verification is not available');
  }

  return payload.data.weather;
}

export async function verifyWeatherForJob(
  token: string,
  jobId: string,
  force = false
): Promise<WeatherVerification> {
  const payload = await requestJson<{ data?: { weather?: WeatherVerification } }>(
    '/api/weather/verify',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ jobId, force }),
    }
  );

  if (!payload.data?.weather?.summary) {
    throw new Error('Weather verification failed');
  }

  return payload.data.weather;
}

export async function fetchReportLanguage(token: string): Promise<ReportLanguagePackage> {
  const payload = await requestJson<{ data?: { reportLanguage?: ReportLanguagePackage } }>(
    '/api/templates/report-language',
    { method: 'GET', token }
  );
  return payload.data?.reportLanguage || {};
}

export type StaticMapType = 'roadmap' | 'satellite';

/** Fetch a Google/Mapbox static map image as a data URI for PDF embedding. */
export async function fetchStaticMapDataUri(
  token: string,
  coords: { latitude: number; longitude: number },
  maptype: StaticMapType
): Promise<string | null> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    maptype,
  });

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/maps/static?${params.toString()}`, {
      headers: {
        Accept: 'image/*',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = globalThis.btoa(binary);
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function fetchPropertyMapPair(
  token: string,
  coords: { latitude: number; longitude: number }
): Promise<{ roadmap: string | null; satellite: string | null }> {
  const [roadmap, satellite] = await Promise.all([
    fetchStaticMapDataUri(token, coords, 'roadmap'),
    fetchStaticMapDataUri(token, coords, 'satellite'),
  ]);
  return { roadmap, satellite };
}

export async function uploadJobPhoto(
  token: string,
  jobId: string,
  photo: {
    clientUuid: string;
    uri: string;
    caption?: string;
    stepId?: string;
    sortOrder?: number;
    takenAt?: string;
  }
) {
  const { base64, mimeType } = await readPhotoBase64(photo.uri);
  const payload = await requestJson<{ data?: { photo?: unknown } }>(`/api/photos/jobs/${jobId}`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      clientUuid: photo.clientUuid,
      base64,
      mimeType,
      caption: photo.caption || '',
      stepId: photo.stepId || '',
      sortOrder: photo.sortOrder ?? 0,
      takenAt: photo.takenAt,
      fileName: `${photo.clientUuid}.jpg`,
    }),
  });
  return payload.data?.photo;
}

export async function submitInspectionPackage(
  token: string,
  jobId: string,
  body: {
    clientUuid?: string;
    summary?: { overallNotes?: string };
    capture?: Partial<InspectionData>;
    pdfBase64?: string;
    pdfFileName?: string;
    narrative?: string;
  }
): Promise<SubmitPackageResult> {
  const payload = await requestJson<{ data?: SubmitPackageResult; message?: string }>(
    `/api/jobs/${jobId}/submit`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }
  );
  return payload.data || {};
}

/** Upload photos then submit package + PDF to admin. */
export async function sendEvidenceToAdmin(params: {
  token: string;
  data: InspectionData;
  pdfUri: string;
}): Promise<SubmitPackageResult> {
  const { token, data, pdfUri } = params;
  if (!data.jobId) {
    throw new Error('Missing job id');
  }

  let uploaded = 0;
  const photosToUpload = data.photos.filter((photo) => photo.includeInReport !== false);
  for (let index = 0; index < photosToUpload.length; index += 1) {
    const photo = photosToUpload[index];
    try {
      await uploadJobPhoto(token, data.jobId, {
        clientUuid: photo.id,
        uri: photo.uri,
        caption: [photo.label, photo.component, photo.notes].filter(Boolean).join(' · '),
        stepId: photo.stepId,
        sortOrder: index,
        takenAt: photo.createdAt,
      });
      uploaded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Photo upload failed';
      throw new Error(`Photo upload failed (${photo.label || index + 1}): ${message}`);
    }
  }

  const { readAsStringAsync } = await import('expo-file-system/legacy');
  const pdfBase64 = await readAsStringAsync(pdfUri, { encoding: 'base64' });

  const result = await submitInspectionPackage(token, data.jobId, {
    clientUuid: `inspection-${data.jobId}`,
    summary: {
      overallNotes: [
        data.reportNarrative,
        data.buildNotes.texts.additionalBuildNotes,
        data.buildNotes.texts.specialConditions,
        data.buildNotes.texts.roofConstruction,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
    capture: {
      homeownerName: data.homeownerName,
      address: data.address,
      completedSteps: data.completedSteps,
      buildNotes: data.buildNotes,
      weatherSummary: data.weatherSummary,
      weatherMatchStatus: data.weatherMatchStatus,
      claimNumber: data.claimNumber,
      policyNumber: data.policyNumber,
      dateOfLoss: data.dateOfLoss,
      reportNarrative: data.reportNarrative,
    },
    pdfBase64,
    pdfFileName: `RoofCheck_${data.jobId}.pdf`,
    narrative: [
      `Customer: ${data.homeownerName || data.customer}`,
      `Property: ${data.address}`,
      data.weatherSummary
        ? `Weather: ${data.weatherSummary.badgeTitle} — ${data.weatherSummary.weather}`
        : '',
      data.reportNarrative || '',
      data.buildNotes.texts.additionalBuildNotes || '',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return { ...result, photosUploaded: uploaded };
}

export function jobDateOfLoss(job: InspectionJob): string | null {
  const value = job.dateOfLoss || job.claim?.dateOfLoss || null;
  return value ? String(value) : null;
}

export function jobCoordinates(job: InspectionJob): { latitude: number; longitude: number } | null {
  const latitude = job.latitude ?? job.geocode?.latitude;
  const longitude = job.longitude ?? job.geocode?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

export function formatLatitude(latitude: number | null | undefined): string {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) {
    return '—';
  }
  return `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
}

export function formatLongitude(longitude: number | null | undefined): string {
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    return '—';
  }
  return `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
}

export function jobCustomerName(job: InspectionJob): string {
  return job.customer?.name?.trim() || 'Unknown customer';
}

export function jobAddressText(job: InspectionJob): string {
  const address = job.address;
  if (!address) {
    return '';
  }
  if (address.formatted?.trim()) {
    return address.formatted.trim();
  }

  return [address.line1, address.city, address.state].filter(Boolean).join(', ');
}

export function jobStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function jobDateLabel(job: InspectionJob): string {
  const iso = job.scheduledAt || job.createdAt;
  if (!iso) {
    return 'Unscheduled';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unscheduled';
  }

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return `Today, ${time}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${time}`;
  }

  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}
