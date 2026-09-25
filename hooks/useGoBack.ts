// Back navigation for the routes pushed on top of the root stack.
//
// router.back() on its own is not enough: it no-ops when there is no history,
// which happens on a cold start landing straight on one of these screens — a
// push notification, or a fast-refresh in dev. The old <Slot /> root masked
// that by unmounting the whole group and falling back to the feed (which is
// also why every back button used to land on the feed). Under a real <Stack />
// the press would simply do nothing and read as a frozen screen, so each
// pushed route names the screen it belongs under.

import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

export function useGoBack(fallback: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
