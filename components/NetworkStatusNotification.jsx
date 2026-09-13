import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useNetwork } from '../context/NetworkContext';
import { useLanguage } from '../context/LanguageContext';
import { Text } from './ui';

const NetworkStatusNotification = () => {
  const { isConnected, isOffline } = useNetwork();
  const { t } = useLanguage();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState(null); // 'offline' or 'online'
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isConnected && !isOffline) {
      // User just went offline
      setNotificationType('offline');
      setShowNotification(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 4 seconds
      const timer = setTimeout(() => {
        hideNotification();
      }, 4000);

      return () => clearTimeout(timer);
    } else if (isConnected && isOffline) {
      // User just came back online
      setNotificationType('online');
      setShowNotification(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        hideNotification();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isConnected, isOffline]);

  const hideNotification = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowNotification(false);
      setNotificationType(null);
    });
  };

  if (!showNotification) return null;

  return (
    <Animated.View
      style={[
        styles.notification,
        notificationType === 'offline' ? styles.offline : styles.online,
        { opacity: fadeAnim },
      ]}
    >
      <Text style={styles.notificationText}>
        {notificationType === 'offline' 
          ? t('network.offline') 
          : t('network.online')}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  notification: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  offline: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  online: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default NetworkStatusNotification;
