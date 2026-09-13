import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './ui';
import { useNetwork } from '../context/NetworkContext';
import { useLanguage } from '../context/LanguageContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const OfflineModeBanner = () => {
  const { isConnected } = useNetwork();
  const { t } = useLanguage();

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color="#F59E0B" />
      <Text style={styles.bannerText}>{t('network.offlineMode')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
});

export default OfflineModeBanner;
