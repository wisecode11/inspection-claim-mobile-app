import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { loadSession, saveSession } from '@/lib/auth-storage';
import { setOnline } from '@/lib/connectivity';
import type { InspectionData } from '@/lib/inspection-types';
import { readPhotoBase64ForUpload } from '@/lib/photo-storage';
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

/** Report summary included on the job detail payload (not on the list). */
export type JobReport = {
  id: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | string;
  pdfStatus?: string;
  version?: number;
  title?: string;
  pdfUrl?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string;
  rejectionReason?: string;
  changesRequested?: string;
};

export type InspectionJob = {
  id: string;
  jobNumber?: string;
  status: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  reports?: JobReport[];
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

/** Thrown when the request never reached the server, as opposed to the server rejecting it. */
export class NetworkError extends Error {}

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

/** Server-relative paths (e.g. uploaded avatars at `/api/avatars/...`) need the API host prepended. */
export function resolveApiUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/') ? `${getApiBaseUrl()}${url}` : url;
}

const PING_TIMEOUT_MS = 5000;

/**
 * Lightweight reachability probe for the connectivity indicator. Any HTTP
 * response (even an error status) means the device can reach the backend.
 */
export async function pingApi(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    await fetch(`${getApiBaseUrl()}/`, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let refreshInFlight: Promise<string | null> | null = null;

type TokenRefreshListener = (token: string) => void;
type SessionExpiredListener = () => void;

let tokenRefreshListener: TokenRefreshListener | null = null;
let sessionExpiredListener: SessionExpiredListener | null = null;

/**
 * AuthContext registers this so a silently-refreshed token propagates into
 * React state immediately, instead of every screen keeping the stale token
 * and re-triggering a refresh-then-retry round trip on its next call.
 */
export function onTokenRefreshed(listener: TokenRefreshListener | null) {
  tokenRefreshListener = listener;
}

/** AuthContext registers this to force a logout when the refresh token is dead. */
export function onSessionExpired(listener: SessionExpiredListener | null) {
  sessionExpiredListener = listener;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const session = await loadSession();
    if (!session.refreshToken) {
      sessionExpiredListener?.();
      return null;
    }

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
      if (!accessToken) {
        sessionExpiredListener?.();
        return null;
      }

      await saveSession({
        token: accessToken,
        refreshToken: nextRefresh || null,
        user: session.user,
        company: session.company,
      });
      tokenRefreshListener?.(accessToken);
      return accessToken;
    } catch (error) {
      // A network failure means we couldn't ask the server, not that the
      // refresh token is invalid — don't log the user out over a dead signal.
      if (!(error instanceof NetworkError)) {
        sessionExpiredListener?.();
      }
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
    setOnline(false);
    throw new NetworkError('Cannot reach the server. Make sure the backend is running.');
  }
  setOnline(true);

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

export type ProfileUpdate = {
  firstName: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
};

function userFromPayload(payload: { data?: { user?: AuthUser } }, fallback: string): AuthUser {
  if (!payload.data?.user) {
    throw new Error(fallback);
  }
  return payload.data.user;
}

export async function updateMyProfile(token: string, body: ProfileUpdate): Promise<AuthUser> {
  const payload = await requestJson<{ data?: { user?: AuthUser } }>('/api/auth/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
  return userFromPayload(payload, 'Could not update profile');
}

export type PasswordChangeResult = {
  user: AuthUser;
  token: string;
  refreshToken: string | null;
};

/** Changes the password. The server signs out other devices and returns fresh tokens for this one. */
export async function changeMyPassword(
  token: string,
  body: { currentPassword: string; newPassword: string; deviceId?: string },
): Promise<PasswordChangeResult> {
  const payload = await requestJson<{ data?: LoginApiData }>('/api/auth/me/password', {
    method: 'POST',
    token,
    body: JSON.stringify({ ...body, platform: Platform.OS }),
  });

  const user = payload.data?.user;
  const nextToken = payload.data?.tokens?.accessToken || payload.data?.token;
  if (!user || !nextToken) {
    throw new Error('Could not update password');
  }
  return { user, token: nextToken, refreshToken: payload.data?.tokens?.refreshToken || null };
}

export async function uploadMyAvatar(token: string, base64: string): Promise<AuthUser> {
  const payload = await requestJson<{ data?: { user?: AuthUser } }>('/api/auth/me/avatar', {
    method: 'PUT',
    token,
    body: JSON.stringify({ base64 }),
  });
  return userFromPayload(payload, 'Could not update profile photo');
}

export async function removeMyAvatar(token: string): Promise<AuthUser> {
  const payload = await requestJson<{ data?: { user?: AuthUser } }>('/api/auth/me/avatar', {
    method: 'DELETE',
    token,
  });
  return userFromPayload(payload, 'Could not remove profile photo');
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
  const { base64, mimeType } = await readPhotoBase64ForUpload(photo.uri);
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

const PHOTO_UPLOAD_CONCURRENCY = 4;

/**
 * Uploads photos with a bounded worker pool instead of one-at-a-time.
 * Each photo keeps its original `sortOrder`, so completion order never
 * affects the final ordering on the server. As soon as one upload fails,
 * no new uploads are started (in-flight ones are left to finish) and the
 * first failure — naming the specific photo — is thrown, matching the
 * previous sequential behavior.
 */
async function uploadPhotosWithLimit(
  token: string,
  jobId: string,
  photos: InspectionData['photos'],
): Promise<number> {
  let cursor = 0;
  let uploaded = 0;
  let firstError: Error | null = null;

  async function worker() {
    while (!firstError) {
      const index = cursor;
      if (index >= photos.length) return;
      cursor += 1;
      const photo = photos[index];
      try {
        await uploadJobPhoto(token, jobId, {
          clientUuid: photo.id,
          uri: photo.uri,
          caption: [photo.label, photo.component, photo.notes].filter(Boolean).join(' · '),
          stepId: photo.stepId,
          sortOrder: index,
          takenAt: photo.createdAt,
        });
        uploaded += 1;
      } catch (error) {
        if (!firstError) {
          const message = error instanceof Error ? error.message : 'Photo upload failed';
          firstError = new Error(`Photo upload failed (${photo.label || index + 1}): ${message}`);
        }
      }
    }
  }

  const workerCount = Math.min(PHOTO_UPLOAD_CONCURRENCY, photos.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (firstError) throw firstError;
  return uploaded;
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

  const photosToUpload = data.photos.filter((photo) => photo.includeInReport !== false);
  const uploaded = await uploadPhotosWithLimit(token, data.jobId, photosToUpload);

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

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Pending Approval',
  reviewed: 'Pending Approval',
  review_required: 'Pending Approval',
  report_generated: 'Pending Approval',
  completed: 'Approved',
  rejected: 'Rejected',
};

export function jobStatusLabel(status: string): string {
  const known = STATUS_LABELS[status.toLowerCase()];
  if (known) return known;
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
export async function registerPushTokenWithApi(
  token: string,
  body: {
    deviceId: string;
    platform: 'ios' | 'android';
    pushToken: string;
    pushEnabled?: boolean;
    appVersion?: string;
    osVersion?: string;
    name?: string;
  }
): Promise<void> {
  await requestJson('/api/devices/push-token', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function updatePushPreferenceWithApi(
  token: string,
  body: { deviceId: string; pushEnabled: boolean }
): Promise<void> {
  await requestJson('/api/devices/push-preference', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export async function clearPushTokenWithApi(
  token: string,
  body: { deviceId: string }
): Promise<void> {
  await requestJson('/api/devices/push-token/clear', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  data: {
    jobId?: string;
    jobNumber?: string;
  };
  readAt: string | null;
  createdAt: string | null;
};

export async function fetchNotifications(
  token: string,
  options: { limit?: number; unreadOnly?: boolean } = {}
): Promise<{ items: InboxNotification[]; unreadCount: number }> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.unreadOnly) params.set('unreadOnly', 'true');
  const qs = params.toString();
  const payload = await requestJson<{
    data?: { items?: InboxNotification[]; unreadCount?: number };
  }>(`/api/notifications${qs ? `?${qs}` : ''}`, { token });

  return {
    items: payload.data?.items ?? [],
    unreadCount: payload.data?.unreadCount ?? 0,
  };
}

export async function fetchUnreadNotificationCount(token: string): Promise<number> {
  const payload = await requestJson<{ data?: { unreadCount?: number } }>(
    '/api/notifications/unread-count',
    { token }
  );
  return payload.data?.unreadCount ?? 0;
}

export async function markNotificationRead(
  token: string,
  notificationId: string
): Promise<InboxNotification> {
  const payload = await requestJson<{ data?: { notification?: InboxNotification } }>(
    `/api/notifications/${notificationId}/read`,
    { method: 'PATCH', token }
  );
  if (!payload.data?.notification) {
    throw new Error('Could not mark notification read');
  }
  return payload.data.notification;
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const payload = await requestJson<{ data?: { updated?: number } }>(
    '/api/notifications/read-all',
    { method: 'PATCH', token }
  );
  return payload.data?.updated ?? 0;
}
