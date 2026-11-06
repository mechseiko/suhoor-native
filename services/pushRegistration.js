import { NativeModules, Platform } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/firestoreSchema';

/**
 * Stores the device's FCM token on the user's profile so the backend can buzz
 * this phone even when the app is not running.
 *
 * The buzz itself is handled natively (push/SuhoorMessagingService), so nothing
 * here needs to stay alive — this only keeps the server's copy of the token
 * fresh (tokens rotate on reinstall / clear-data / occasionally on their own).
 */
export const registerPushToken = async (uid) => {
  if (Platform.OS !== 'android' || !uid) return false;

  const bridge = NativeModules?.AlarmBridge;
  if (!bridge?.getFcmToken) return false;

  try {
    const token = await bridge.getFcmToken();
    if (!token) return false;

    await setDoc(
      doc(db, COLLECTIONS.profiles, uid),
      {
        fcmToken: token,
        fcmPlatform: 'android',
        fcmTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    // Never block sign-in on push registration.
    console.log('[push] Could not register FCM token:', error?.message || error);
    return false;
  }
};

export default registerPushToken;
