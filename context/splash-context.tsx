import { createContext, useContext } from 'react';

/**
 * True once the animated splash overlay has been removed. Screens mounted
 * underneath it (e.g. login) use this to hold entrance animations until
 * they are actually visible.
 */
export const SplashDoneContext = createContext(true);

export function useSplashDone() {
  return useContext(SplashDoneContext);
}
