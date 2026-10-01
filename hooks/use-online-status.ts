import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { pingApi } from '@/lib/api';
import { isOnline, setOnline, subscribeConnectivity } from '@/lib/connectivity';

/** Poll slowly while online, faster while offline so recovery shows up quickly. */
const ONLINE_POLL_MS = 20_000;
const OFFLINE_POLL_MS = 5_000;

// One shared poller no matter how many screens show the indicator.
let consumers = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

async function probe() {
  if (timer) clearTimeout(timer);
  timer = null;
  setOnline(await pingApi());
  // Another probe (e.g. from AppState) may have scheduled a timer meanwhile; keep exactly one.
  if (timer) clearTimeout(timer);
  timer = null;
  if (consumers > 0) {
    timer = setTimeout(() => void probe(), isOnline() ? ONLINE_POLL_MS : OFFLINE_POLL_MS);
  }
}

function startPolling() {
  consumers += 1;
  if (consumers > 1) return;
  void probe();
  // Re-check the moment the app comes back to the foreground.
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void probe();
  });
}

function stopPolling() {
  consumers = Math.max(0, consumers - 1);
  if (consumers > 0) return;
  if (timer) clearTimeout(timer);
  timer = null;
  appStateSub?.remove();
  appStateSub = null;
}

/** True when the backend is reachable; false when the device is offline or the server is down. */
export function useOnlineStatus(): boolean {
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, []);

  return useSyncExternalStore(subscribeConnectivity, isOnline, isOnline);
}
