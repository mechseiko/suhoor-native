import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from './ui';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { brand, radius, spacing } from '../theme';

export const UpdateModal = ({
  visible,
  currentVersion,
  latestVersion,
  playStoreUrl,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  if (!visible) return null;

  const handleUpdate = () => {
    const url =
      playStoreUrl ||
      'https://play.google.com/store/apps/details?id=com.mechseiko.suhoor';
    Linking.openURL(url).catch((err) =>
      console.error('[UpdateModal] Could not open Play Store URL:', err)
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface || (isDark ? '#1F1A2E' : '#FFFFFF'),
              borderColor: colors.border || (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'),
            },
          ]}
        >
          {/* Badge Icon */}
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isDark
                  ? 'rgba(242, 159, 29, 0.15)'
                  : 'rgba(242, 159, 29, 0.1)',
              },
            ]}
          >
            <Ionicons
              name="cloud-download-outline"
              size={36}
              color={brand.primary || '#F29F1D'}
            />
          </View>

          {/* Titles */}
          <Text variant="h2" style={[styles.title, { color: colors.text }]}>
            {t('update.title', 'Update Available')}
          </Text>

          <Text
            variant="body"
            style={[styles.description, { color: colors.textSecondary }]}
          >
            {t(
              'update.message',
              'A newer version of Suhoor is available on the Google Play Store. Update now for improved performance, wake-up features, and stability.'
            )}
          </Text>

          {/* Versions Comparison Box */}
          <View
            style={[
              styles.versionBox,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.03)',
                borderColor: colors.border || 'rgba(150, 150, 150, 0.15)',
              },
            ]}
          >
            <View style={styles.versionCol}>
              <Text variant="caption" tone="secondary">
                {t('update.current', 'Current')}
              </Text>
              <Text variant="body" style={styles.versionText}>
                v{currentVersion || '1.0.0'}
              </Text>
            </View>

            <Ionicons
              name="arrow-forward"
              size={18}
              color={brand.primary || '#F29F1D'}
            />

            <View style={styles.versionCol}>
              <Text variant="caption" tone="secondary">
                {t('update.latest', 'Latest')}
              </Text>
              <Text
                variant="body"
                style={[
                  styles.versionText,
                  { color: brand.primary || '#F29F1D', fontWeight: '700' },
                ]}
              >
                v{latestVersion || '1.0.0'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.primaryBtn,
              { backgroundColor: brand.primary || '#F29F1D' },
            ]}
            onPress={handleUpdate}
          >
            <Ionicons name="logo-google-playstore" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>
              {t('update.button', 'Update on Play Store')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.laterBtn}
            onPress={onClose}
          >
            <Text
              variant="body"
              style={[styles.laterBtnText, { color: colors.textSecondary }]}
            >
              {t('common.later', 'Maybe Later')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl || 20,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  versionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md || 12,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  versionCol: {
    alignItems: 'center',
  },
  versionText: {
    fontWeight: '600',
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    borderRadius: radius.md || 12,
    gap: 8,
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  laterBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  laterBtnText: {
    fontWeight: '500',
  },
});

export default UpdateModal;
