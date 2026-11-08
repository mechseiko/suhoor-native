import React, { createContext, useContext, useState, useEffect } from "react";
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
} from "firebase/firestore";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { detectUserLocationDetails } from "../utils/country";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID } from "@env";
import { registerPushToken } from "../services/pushRegistration";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Configure Google Sign-In outside the component
GoogleSignin.configure({
  webClientId: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
});

/**
 * Returns a profile that owns this email under a *different* uid, or null.
 * Used to guarantee one account per email even if Firebase auth ever hands back
 * a second identity for the same address.
 */
const findOtherProfileWithEmail = async (email, uid) => {
  if (!email) return null;
  try {
    const profiles = collection(db, 'profiles');
    const snap = await getDocs(
      query(profiles, where('email', '==', email), limit(5))
    );
    const other = snap.docs.find((d) => d.id !== uid);
    return other ? { id: other.id, ...other.data() } : null;
  } catch (error) {
    console.log('Could not check for duplicate profiles:', error?.message);
    return null;
  }
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
      return await createUserWithEmailAndPassword(auth, email, password);
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
        // Sync avatar from Google if not yet set in profile
        const updateData = { authProvider: "google" };
        if (user.photoURL && !profileDoc.data()?.avatar_url && !profileDoc.data()?.photoURL) {
          updateData.avatar_url = user.photoURL;
          updateData.photoURL = user.photoURL;
        }
        await updateDoc(doc(db, "profiles", user.uid), updateData).catch(() => {});

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
      AsyncStorage[user?.uid ? 'setItem' : 'removeItem'](
        'suhoor_session_uid',
        ...(user?.uid ? [user.uid] : [])
      ).catch(() => {});

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