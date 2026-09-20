import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useNetwork } from '../context/NetworkContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from './ui';

const NetworkStatusNotification = () => {
  const { isConnected, isOffline } = useNetwork();
  const { t } = useLanguage();
  const { isDark } = useTheme();
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

  const isOfflineType = notificationType === 'offline';

  const containerStyle = isDark
    ? (isOfflineType ? styles.offlineDark : styles.onlineDark)
    : (isOfflineType ? styles.offlineLight : styles.onlineLight);

  const iconColor = isDark
    ? (isOfflineType ? '#FCA5A5' : '#86EFAC')
    : (isOfflineType ? '#DC2626' : '#16A34A');

  const textColor = isDark
    ? (isOfflineType ? '#FEE2E2' : '#F0FDF4')
    : (isOfflineType ? '#991B1B' : '#166534');

  return (
    <Animated.View
      style={[
        styles.notification,
        containerStyle,
        { opacity: fadeAnim },
      ]}
    >
      <View style={styles.contentRow}>
        <Ionicons
          name={isOfflineType ? 'cloud-offline-outline' : 'checkmark-circle-outline'}
          size={18}
          color={iconColor}
          style={styles.icon}
        />
        <Text style={[styles.notificationText, { color: textColor }]}>
          {isOfflineType 
            ? t('network.offline') 
            : t('network.online')}
        </Text>
        <TouchableOpacity
          onPress={hideNotification}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtn}
          accessibilityLabel="Dismiss"
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={16} color={iconColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  notification: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    zIndex: 9999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  closeBtn: {
    marginLeft: 8,
    padding: 2,
  },
  offlineLight: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  onlineLight: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  offlineDark: {
    backgroundColor: '#3F1212',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  onlineDark: {
    backgroundColor: '#063826',
    borderWidth: 1,
    borderColor: '#065F46',
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NetworkStatusNotification;
