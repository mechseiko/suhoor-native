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
  linkWithCredential,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, onSnapshot, updateDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { detectUserLocationDetails } from "../utils/country";
import { GoogleSignin } from "@react-native-google-signin/google-signin"; // ADDED THIS

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Configure Google Sign-In outside the component
GoogleSignin.configure({
  webClientId: '436930754190-6m8r5cegt0pa6mil8ujb8n1d2r9pmvk3.apps.googleusercontent.com',
  offlineAccess: true,
});

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
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Account linking is handled automatically by Firebase when using the same email
      return userCredential;
    } catch (error) {
      throw error;
    }
  };

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
        userCredential = await signInWithCredential(auth, googleCredential);
      }

      const user = userCredential.user;

      // ACCOUNT LINKING: Check if email already exists with password provider
      try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, user.email);
        if (signInMethods.includes('password') && !signInMethods.includes('google.com')) {
          // Email exists with password but not linked to Google - link it
          if (googleCredential) {
            await linkWithCredential(user, googleCredential);
            console.log("Google credential linked to existing email/password account");
          }
        }
      } catch (linkErr) {
        // Ignore linking errors (might already be linked or other issues)
        console.log("Account linking note:", linkErr.message);
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

      if (user) {
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