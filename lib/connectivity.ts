/**
 * App-wide "can we reach the backend?" flag.
 *
 * Kept dependency-free so both the API layer (which reports every request's
 * outcome) and the polling hook can import it without a require cycle.
 */
type Listener = () => void;

let online = true;
const listeners = new Set<Listener>();

export function isOnline(): boolean {
  return online;
}

export function setOnline(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((listener) => listener());
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
