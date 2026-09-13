import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

const NetworkContext = createContext(null);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};

export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const wasConnectedRef = useRef(true);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable;
      setIsConnected(connected);
      
      // Track offline state for notification purposes
      if (!connected && wasConnectedRef.current) {
        // User just went offline
        setIsOffline(true);
        wasConnectedRef.current = false;
      } else if (connected && !wasConnectedRef.current) {
        // User just came back online
        setIsOffline(false);
        wasConnectedRef.current = true;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const value = {
    isConnected,
    isOffline,
  };

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export default NetworkContext;
