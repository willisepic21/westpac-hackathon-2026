// Tiny app-wide navigation (the app doesn't use Expo Router): which tab is open, and an optional
// sub-screen inside it, e.g. navigate('More', 'Actions') from the Home screen's Actions card.

import { useSyncExternalStore } from 'react';

let route = { tab: 'Home', screen: null };
const listeners = new Set();

export function navigate(tab, screen = null) {
  route = { tab, screen };
  listeners.forEach((l) => l());
}

export const useRoute = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => route,
    () => route,
  );
