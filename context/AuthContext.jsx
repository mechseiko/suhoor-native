import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reload,
} from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

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

  const logout = async () => {
    setCurrentUser(null);
    setUserProfile(null);
    await signOut(auth);
  };

  // Increment this to force RootNavigator's useEffect to re-run
  const [reloadTick, setReloadTick] = useState(0);

  const reloadUser = async () => {
    if (!auth.currentUser) return false;
    try {
      await reload(auth.currentUser);
      const user = auth.currentUser;
      // Keep the real Firebase User object — never spread it (spreading strips class methods).
      // Force React to notice the change by bumping a sibling counter.
      setCurrentUser(user);
      setReloadTick(t => t + 1);
      if (user?.emailVerified && user?.uid) {
        try {
          await updateDoc(doc(db, "profiles", user.uid), { isVerified: true });
          // Optimistically update userProfile so RootNavigator switches immediately
          setUserProfile(prev => prev ? { ...prev, isVerified: true } : prev);
        } catch (e) {}
      }
      return user?.emailVerified ?? false;
    } catch (err) {
      console.error("reloadUser error:", err);
      return false;
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

  const value = {
    currentUser,
    reloadTick,
    loading,
    userProfile,
    profileLoading,
    signup,
    login,
    logout,
    reloadUser,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
