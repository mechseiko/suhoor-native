import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reload,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { auth, db } from "../config/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { detectUserLocationDetails } from "../utils/country";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID } from "@env";
import { registerPushToken } from "../services/pushRegistration";
import { profileCreatedAtDate } from "../config/firestoreSchema";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Configure Google Sign-In outside the component
GoogleSignin.configure({
  webClientId: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
});

/**
 * Firebase Auth records the account creation time. It is the only trustworthy
 * signup date for profiles written before `createdAt` existed, so it is what a
 * missing date is back-filled from.
 */
const authCreatedAtDate = (user) => {
  const raw = user?.metadata?.creationTime;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Best date available for a profile that has no `createdAt` yet. */
const resolveCreatedAt = (user, profileData) =>
  profileCreatedAtDate(profileData) || authCreatedAtDate(user);

/** Which provider this auth account actually uses, for profile repairs. */
const providerFromUser = (user) =>
  user?.providerData?.some((p) => p.providerId === "google.com")
    ? "google"
    : "password";

// Profile docs may store emails in any case; match all common variants so a
// "User@Gmail.com" profile still blocks a "user@gmail.com" sign-in.
const emailVariants = (email) => {
  const e = (email || '').trim();
  if (!e) return [];
  return [...new Set([e, e.toLowerCase(), e.toUpperCase()])];
};

const findProfilesByEmail = async (email) => {
  const variants = emailVariants(email);
  if (!variants.length) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'profiles'),
        where('email', 'in', variants),
        limit(10)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.log('Could not check for duplicate profiles:', error?.message);
    return null; // null = lookup failed (offline etc.), distinct from []
  }
};

/**
 * Returns a profile that owns this email under a *different* uid, or null.
 * Used to guarantee one account per email even if Firebase auth ever hands back
 * a second identity for the same address.
 */
const findOtherProfileWithEmail = async (email, uid) => {
  const profiles = await findProfilesByEmail(email);
  if (!profiles) return null;
  const other = profiles.find((p) => p.id !== uid);
  return other || null;
};

/**
 * Pre-sign-in check: does a password account already own this email?
 * Runs before signInWithCredential so a conflict is rejected while the user
 * is still on the auth screen — no dashboard flash, no sign-out bounce.
 * Google-provider profiles are ignored: the same Google email always maps to
 * the same Firebase uid, so that profile IS this account, not a duplicate.
 */
const findPasswordProfileWithEmail = async (email) => {
  const profiles = await findProfilesByEmail(email);
  if (!profiles) return null;
  return profiles.find((p) => p.authProvider === 'password') || null;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const signup = async (email, password) => {
    try {
      // Check if email already exists with Google provider
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.includes('google.com') && !signInMethods.includes('password')) {
        const error = new Error("This email is already registered with Google. Please sign in with Google or link your account first.");
        error.code = "auth/email-already-linked-to-google";
        throw error;
      }
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // One email = one account. fetchSignInMethodsForEmail can return an
      // empty list (enumeration protection), and Firebase's
      // multiple-accounts-per-email setting would let this create a SECOND
      // identity for an email that already owns a profile (e.g. Google).
      // Verify against profiles and remove the just-created user on conflict.
      const owner = await findOtherProfileWithEmail(email, credential.user.uid);
      if (owner) {
        try {
          await deleteUser(credential.user);
        } catch (deleteErr) {
          console.log('Could not delete duplicate auth user:', deleteErr?.message);
        }
        const conflict = new Error('This email already has an account.');
        conflict.code = 'auth/account-conflict';
        throw conflict;
      }

      return credential;
    } catch (error) {
      // Email enumeration protection can make the check above return nothing.
      // The sign-up call still fails safely; explain it in the same terms.
      if (error.code === 'auth/email-already-in-use') {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('google.com')) {
            const mapped = new Error('This email already has a Google account.');
            mapped.code = 'auth/email-already-linked-to-google';
            throw mapped;
          }
        } catch (inner) {
          if (inner.code === 'auth/email-already-linked-to-google') throw inner;
        }
      }
      throw error;
    }
  };

  /**
   * Email + password sign-in. A Google-only account cannot get in here: no
   * password is set on it, so Firebase rejects the credentials. LoginScreen
   * tells the user to continue with Google instead.
   */
  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * We only allow one provider per email address.
   * A password account can never be entered through Google and vice versa —
   * attempted cross-provider sign-in is rejected with a clear code and the
   * user is told which method their email belongs to.
   */
  const signInWithGoogle = async () => {
    try {
      let userCredential;
      let googleCredential;

      if (Platform.OS === 'web') {
        // WEB FLOW
        const provider = new GoogleAuthProvider();
        provider.addScope("profile");
        provider.addScope("email");
        userCredential = await signInWithPopup(auth, provider);
      } else {
        // NATIVE MOBILE FLOW
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();

        // Handle different versions of the library
        const idToken = response.data?.idToken || response.idToken;

        if (!idToken) {
           throw new Error("No ID token returned from Google");
        }

        // Reject a password-owned email BEFORE Firebase sign-in, so the auth
        // state never flips and the user never sees the dashboard flash.
        const googleEmail =
          response.data?.user?.email || response.user?.email || null;
        if (googleEmail && (await findPasswordProfileWithEmail(googleEmail))) {
          const conflict = new Error(
            'This email is registered with a password.'
          );
          conflict.code = 'auth/provider-password';
          throw conflict;
        }

        googleCredential = GoogleAuthProvider.credential(idToken);
        try {
          userCredential = await signInWithCredential(auth, googleCredential);
        } catch (credentialError) {
          if (credentialError.code === 'auth/account-exists-with-different-credential') {
            const conflict = new Error(
              'This email is registered with a password.'
            );
            conflict.code = 'auth/provider-password';
            throw conflict;
          }
          throw credentialError;
        }
      }

      const user = userCredential.user;

      // Defence in depth: never allow a second account for an email that
      // already owns a profile (protects against legacy duplicates and the
      // case where the console setting is ever turned off).
      const duplicate = await findOtherProfileWithEmail(user.email, user.uid);
      if (duplicate) {
        await signOut(auth);
        if (Platform.OS !== 'web') {
          try {
            await GoogleSignin.signOut();
          } catch (e) {}
        }
        const conflict = new Error('This email already has an account.');
        conflict.code = 'auth/account-conflict';
        throw conflict;
      }

      // Check if user profile exists in Firestore, if not create it
      const profileDoc = await getDoc(doc(db, "profiles", user.uid));
      if (!profileDoc.exists()) {
        let alarmPin = "";
        let fastingDefaults = {
          sunnah: true,
          whiteDays: true,
          ramadan: true,
        };

        try {
          alarmPin = (await AsyncStorage.getItem("suhoor_alarm_pin")) || "";
          const storedDefaults = await AsyncStorage.getItem(
            "onboarding_fasting_defaults"
          );
          if (storedDefaults) {
            fastingDefaults = JSON.parse(storedDefaults);
          }
        } catch (storageErr) {
          console.log(
            "Error reading AsyncStorage during Google sign-in:",
            storageErr
          );
        }

        let userCountry = "Unknown";
        let state = "";
        let city = "";
        try {
          const locationDetails = await detectUserLocationDetails();
          userCountry = locationDetails.locationString || "Unknown";
          state = locationDetails.state || "";
          city = locationDetails.city || "";
        } catch (locErr) {
          console.log("Error detecting location during Google sign-in:", locErr);
        }

        await setDoc(doc(db, "profiles", user.uid), {
          uid: user.uid,
          email: user.email,
          display_name:
            user.displayName ||
            (user.email ? user.email.split("@")[0] : "User"),
          avatar_url: user.photoURL || null,
          photoURL: user.photoURL || null,
          isVerified: user.emailVerified ?? true,
          country: userCountry,
          state,
          city,
          pin: alarmPin,
          authProvider: "google",
          createdAt: serverTimestamp(),
          signupSource: Platform.OS === "web" ? "web" : "mobile",
          platform: Platform.OS === "web" ? "web" : "mobile",
          fastingDefaults,
          preferences: {
            soundEnabled: true,
            alarmSound: "default",
          },
        });

        try {
          await AsyncStorage.setItem("suhoor-tab-tour-pending", "true");
        } catch (tourErr) {
          console.log("Error setting tab tour flag:", tourErr);
        }
      } else {
        const existing = profileDoc.data() || {};
        const updateData = {};
        if (!existing.authProvider) updateData.authProvider = "google";

        // Back-fill the signup date for accounts whose profile predates
        // `createdAt` (or was written by the old partial-write fallback). The
        // admin dashboard reads this field as the join date.
        if (!existing.createdAt) {
          const createdAt = resolveCreatedAt(user, existing);
          if (createdAt) updateData.createdAt = Timestamp.fromDate(createdAt);
        }
        if (!existing.uid) updateData.uid = user.uid;

        // Sync avatar from Google if not yet set in profile
        if (user.photoURL && !existing.avatar_url && !existing.photoURL) {
          updateData.avatar_url = user.photoURL;
          updateData.photoURL = user.photoURL;
        }

        if (Object.keys(updateData).length) {
          await updateDoc(doc(db, "profiles", user.uid), updateData).catch(() => {});
        }

        // Sync alarm pin if set in local storage
        try {
          const alarmPin = await AsyncStorage.getItem("suhoor_alarm_pin");
          if (alarmPin && !profileDoc.data()?.pin) {
            await updateDoc(doc(db, "profiles", user.uid), { pin: alarmPin });
          }
        } catch (pinErr) {
          console.log("Error syncing alarm PIN during Google sign-in:", pinErr);
        }

        // Sync verification status if needed
        if (user.emailVerified && !profileDoc.data()?.isVerified) {
          await updateDoc(doc(db, "profiles", user.uid), {
            isVerified: true,
          }).catch(() => {});
        }
      }

      return userCredential;
    } catch (error) {
      console.error("signInWithGoogle error:", error);
      throw error;
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setUserProfile(null);
    await signOut(auth);
    // Also sign out from Google if on native
    if (Platform.OS !== 'web') {
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore error if not signed in
      }
    }
  };

  const deleteAccount = async () => {
    if (currentUser) {
      await deleteUser(currentUser);
      setCurrentUser(null);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      // Remember the signed-in uid so an offline launch can hold the splash
      // instead of showing signup to someone who is still logged in.
      if (user?.uid) {
        AsyncStorage.setItem('suhoor_session_uid', user.uid).catch(() => {});
      } else {
        AsyncStorage.removeItem('suhoor_session_uid').catch(() => {});
      }

      if (user) {
        // Background buzz delivery: keep the server's FCM token in sync.
        registerPushToken(user.uid).catch(() => {});

        // Subscribe to profile updates
        unsubscribeProfile = onSnapshot(
          doc(db, "profiles", user.uid),
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              const profileData = docSnapshot.data();
              setUserProfile(profileData);

              // Sync verification status if needed
              if (user.emailVerified && !profileData.isVerified) {
                updateDoc(docSnapshot.ref, { isVerified: true }).catch((err) =>
                  console.error("Error syncing verification status:", err)
                );
              }
            }
            setProfileLoading(false);
          },
          (error) => {
            console.error("Profile listen error:", error);
            setProfileLoading(false);
          }
        );
      } else {
        setUserProfile(null);
        setProfileLoading(false);
        unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  // Repair profiles whose signup date was never written. Runs once per uid per
  // app launch and only fills missing fields, so it cannot clobber a concurrent
  // sign-up write. Accounts created on older builds (or through the old
  // partial-write fallback) get the real Firebase Auth creation date here,
  // which is what the admin dashboard displays.
  const repairedProfileUids = useRef(new Set());
  useEffect(() => {
    if (!currentUser?.uid) return;
    if (repairedProfileUids.current.has(currentUser.uid)) return;
    repairedProfileUids.current.add(currentUser.uid);

    (async () => {
      try {
        const profileRef = doc(db, "profiles", currentUser.uid);
        const snap = await getDoc(profileRef);
        if (!snap.exists()) return; // sign-up flows create the profile
        const data = snap.data() || {};
        const patch = {};
        if (!data.createdAt) {
          const createdAt = resolveCreatedAt(currentUser, data);
          if (createdAt) patch.createdAt = Timestamp.fromDate(createdAt);
        }
        if (!data.uid) patch.uid = currentUser.uid;
        if (!data.email && currentUser.email) patch.email = currentUser.email;
        if (!data.authProvider) patch.authProvider = providerFromUser(currentUser);
        if (Object.keys(patch).length) {
          await updateDoc(profileRef, patch);
        }
      } catch (err) {
        console.log("Profile date repair failed:", err?.message);
      }
    })();
  }, [currentUser]);

  const reloadUser = async () => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      setCurrentUser(
        Object.assign(
          Object.create(Object.getPrototypeOf(auth.currentUser)),
          auth.currentUser
        )
      );
      return auth.currentUser;
    }
  };

  const value = {
    currentUser,
    loading,
    userProfile,
    profileLoading,
    signup,
    login,
    signInWithGoogle,
    logout,
    deleteAccount,
    reloadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;