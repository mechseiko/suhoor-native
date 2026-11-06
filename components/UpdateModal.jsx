import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from './ui';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { brand, radius, spacing } from '../theme';
import { triggerImmediateUpdate } from '../services/inAppUpdates';

export const UpdateModal = ({
  visible,
  playStoreUrl,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [updating, setUpdating] = useState(false);

  if (!visible) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const url =
        playStoreUrl ||
        'https://play.google.com/store/apps/details?id=com.mechseiko.suhoor';
      await triggerImmediateUpdate(url);
    } catch (err) {
      console.error('[UpdateModal] Could not trigger in-app update:', err);
    } finally {
      setUpdating(false);
    }
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

          {/* Action Buttons */}
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={updating}
            style={[
              styles.primaryBtn,
              { backgroundColor: brand.primary || '#F29F1D', opacity: updating ? 0.75 : 1 },
            ]}
            onPress={handleUpdate}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  {t('update.buttonNow', 'Update Now')}
                </Text>
              </>
            )}
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

/**
 * "What's New" — shown once after the installed build changes.
 *
 * Deliberately in this file and reusing `styles` below, so it looks exactly like
 * the update modal and both stay in one place. It is a *separate* component: the
 * update flow above is untouched.
 *
 * `entries` comes from hooks/useWhatsNew + config/whatsNew.js. With an empty
 * WHATS_NEW map the parent never sets `visible`, so this renders nothing today.
 */
export const WhatsNewModal = ({ visible, entries = [], onClose }) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  if (!visible || !entries.length) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface || (isDark ? '#1F1A2E' : '#FFFFFF'),
              borderColor: colors.border || (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'),
            },
          ]}
        >
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: isDark ? 'rgba(242, 159, 29, 0.15)' : 'rgba(242, 159, 29, 0.1)' },
            ]}
          >
            <Ionicons
              name="sparkles-outline"
              size={32}
              color={brand.primary || '#F29F1D'}
            />
          </View>

          <Text variant="h2" style={[styles.title, { color: colors.text }]}>
            {t('whatsNew.title')}
          </Text>

          <ScrollView
            style={{ alignSelf: 'stretch', maxHeight: 360 }}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
          >
            {entries.map((entry) => (
              <View key={entry.versionCode} style={{ marginBottom: spacing.base }}>
                {entry.versionName ? (
                  <Text variant="caption" tone="secondary" style={{ marginBottom: 2 }}>
                    {t('whatsNew.versionLabel', { version: entry.versionName })}
                  </Text>
                ) : null}

                {entry.titleKey ? (
                  <Text variant="h3" style={{ marginBottom: 4, color: colors.text }}>
                    {t(entry.titleKey)}
                  </Text>
                ) : null}

                {(entry.items || []).map((item, index) => (
                  <View
                    key={`${entry.versionCode}-${index}`}
                    style={{ flexDirection: 'row', columnGap: 8, marginBottom: 6 }}
                  >
                    <Text variant="body" style={{ color: colors.primary }}>
                      •
                    </Text>
                    <View style={{ flex: 1 }}>
                      {item.titleKey ? (
                        <Text variant="body" style={{ fontWeight: '600', color: colors.text }}>
                          {t(item.titleKey)}
                        </Text>
                      ) : null}
                      {item.bodyKey ? (
                        <Text variant="body" tone="secondary" style={{ fontSize: 13 }}>
                          {t(item.bodyKey)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.primaryBtn, { backgroundColor: brand.primary || '#F29F1D' }]}
            onPress={onClose}
          >
            <Text style={styles.primaryBtnText}>{t('whatsNew.gotIt')}</Text>
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
