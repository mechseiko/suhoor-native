import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { getWhatsNewEntries } from '../config/whatsNew';

const SEEN_KEY = 'suhoor_last_seen_version_code';

/**
 * Decides whether the "What's New" screen should appear on this launch.
 *
 * Play's in-app update restarts the process, so there is no reliable moment
 * "after the update finished". Comparing the installed build number with the one
 * last recorded in storage works for every path instead: Play, sideload, OEM
 * updater, and it also aggregates skipped versions.
 *
 * Rules:
 *  - fresh install (nothing stored) -> record the current build and stay silent
 *  - same or older build           -> stay silent (a downgrade re-syncs the key)
 *  - newer build                   -> return that version's entries, and record
 *    the build immediately so a crash can never make it loop
 */
export function useWhatsNew() {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    let cancelled = false;

    const run = async () => {
      try {
        const current = Number(DeviceInfo.getBuildNumber()) || 0;
        if (!current) return; // unknown build (dev / web) — never guess

        const storedRaw = await AsyncStorage.getItem(SEEN_KEY);

        if (storedRaw == null) {
          // First launch of this install: remember it, show nothing.
          await AsyncStorage.setItem(SEEN_KEY, String(current));
          return;
        }

        const stored = Number(storedRaw) || 0;
        if (current <= stored) {
          if (current < stored) {
            // Downgrade / restored backup: re-sync silently.
            await AsyncStorage.setItem(SEEN_KEY, String(current)).catch(() => {});
          }
          return;
        }

        const releaseEntries = getWhatsNewEntries(stored, current);

        // Mark seen before showing: fire-and-forget, so a failed write can never
        // turn this into a screen that reappears on every launch.
        AsyncStorage.setItem(SEEN_KEY, String(current)).catch(() => {});

        if (!cancelled && releaseEntries.length > 0) {
          setEntries(releaseEntries);
          setVisible(true);
        }
      } catch (err) {
        console.log('[WhatsNew] Could not resolve version change:', err?.message);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setEntries([]);
  };

  return { visible, entries, dismiss };
}

export default useWhatsNew;
