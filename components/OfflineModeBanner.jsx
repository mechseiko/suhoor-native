import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './ui';
import { useNetwork } from '../context/NetworkContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const OfflineModeBanner = () => {
  const { isConnected } = useNetwork();
  const { t } = useLanguage();
  const { isDark } = useTheme();

  if (isConnected) return null;

  return (
    <View style={[styles.banner, isDark ? styles.bannerDark : styles.bannerLight]}>
      <Ionicons name="cloud-offline-outline" size={16} color={isDark ? '#FBBF24' : '#D97706'} />
      <Text style={[styles.bannerText, { color: isDark ? '#FEF3C7' : '#92400E' }]}>
        {t('network.offlineMode')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  bannerLight: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bannerDark: {
    backgroundColor: '#451A03',
    borderWidth: 1,
    borderColor: '#78350F',
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineModeBanner;
