import {useEffect, useState} from 'react';
import {AppState} from 'react-native';

import {ChildMode} from '../modules/native';

/**
 * Reactive wrapper around the native `ChildMode.isActive()` flag.
 *
 * Why native is the source of truth (not Firestore):
 *   - Survives JS engine death + OEM kill. After a reboot, this hook returns the correct
 *     value as soon as the JS thread starts up — before any Firestore subscription has
 *     hydrated. That's critical: a child holding the phone post-reboot must land back in
 *     the kiosk on the very first frame.
 *   - Avoids a flicker between "dashboard" and "kiosk" on cold start.
 *   - The Firestore mirror exists for cross-instance visibility (parent flipping kiosk from
 *     a different signed-in device), but the local source-of-truth for routing is native.
 *
 * Re-polls on AppState=active so the value stays fresh after the kiosk's "Exit" PIN flow
 * writes the flag and pops back here. The actual flip-on / flip-off code paths also call
 * `ChildMode.setActive(...)` synchronously, so latency to the hook is one tick.
 *
 * Returns `null` while we haven't read native yet (rare; usually <50ms), then a stable
 * boolean. Callers should treat `null` as "loading" and render a splash, not as "false".
 */
export function useChildModeActive(): boolean | null {
  const [active, setActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      try {
        const isActive = await ChildMode.isActive();
        if (!cancelled) {
          setActive(isActive);
        }
      } catch {
        if (!cancelled) {
          setActive(false);
        }
      }
    }

    read();

    // Re-read whenever the app comes back to foreground. Two cases:
    //   1. Kiosk's ExitPin set it false in another flow → we need to flip out of the kiosk.
    //   2. Parent flipped Start Child Mode while we were backgrounded → flip in.
    // We also poll on a 2s interval as belt-and-braces in case AppState misses an event
    // (some OEMs are erratic about firing it for in-app navigation).
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        read();
      }
    });
    const interval = setInterval(read, 2000);

    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  return active;
}
