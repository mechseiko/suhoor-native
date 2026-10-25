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
} from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, onSnapshot, updateDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { detectUserLocationDetails } from "../utils/country";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    try {
      if (typeof signInWithPopup !== 'function') {
        throw new Error(
          "Google Sign-In via popup is only supported on Web in this setup. Native mobile requires Google Sign-In SDK configuration."
        );
      }

      const provider = new GoogleAuthProvider();
      provider.addScope("profile");
      provider.addScope("email");

      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

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
