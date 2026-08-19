import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export type LoginResult = {
  user: AuthUser;
  token: string;
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
  customer: JobCustomer | null;
  address?: JobAddress | null;
  geocode?: JobGeocode | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ApiErrorBody = {
  success?: boolean;
  message?: string;
};

type RequestOptions = RequestInit & {
  token?: string;
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

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
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

  const payload = (await response.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!response.ok || !payload) {
    const message =
      payload && 'message' in payload && payload.message ? payload.message : 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function loginWithApi(email: string, password: string): Promise<LoginResult> {
  const payload = await requestJson<{ data?: LoginResult }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  if (!payload.data?.token) {
    throw new Error('Login failed');
  }

  return payload.data;
}

export async function fetchJobs(token: string): Promise<InspectionJob[]> {
  const payload = await requestJson<{ data?: { jobs?: InspectionJob[] } }>('/api/jobs', {
    token,
  });

  return payload.data?.jobs ?? [];
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
