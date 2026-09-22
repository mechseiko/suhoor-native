import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { Text } from '../../components/ui';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from '../../components/Toast';
import * as Clipboard from '@react-native-clipboard/clipboard';

export const GroupSettingsScreen = ({ route, navigation }) => {
  const { groupId, groupName, groupKey } = route.params;
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');

  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchGroupDetails = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const groupRef = doc(db, "groups", groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        setGroup({ id: groupSnap.id, ...groupSnap.data() });
      }
    } catch (err) {
      console.error("Error fetching group details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateInviteLink = async () => {
    if (!group) return;
    Alert.alert(
      t('groups.regenerateLinkTitle', 'Regenerate Invite Link'),
      t('groups.regenerateLinkConfirm', 'This will create a new invite link. The old link will no longer work. Continue?'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('groups.regenerate', 'Regenerate'),
          style: "destructive",
          onPress: async () => {
            setRegenerating(true);
            try {
              const newKey = Math.random().toString(36).substring(2, 10).toUpperCase();
              const groupRef = doc(db, "groups", groupId);
              await updateDoc(groupRef, {
                group_key: newKey,
                key_generated_at: serverTimestamp(),
              });
              setGroup((prev) => ({ ...prev, group_key: newKey }));
              triggerToast(t('groups.linkRegenerated', 'Invite link regenerated!'), "success");
            } catch (err) {
              console.error("Error regenerating invite link:", err);
              triggerToast(t('groups.regenerateError', 'Failed to regenerate invite link.'), "error");
            } finally {
              setRegenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleCopyKey = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.group_key);
    triggerToast(t('groups.groupKeyCopied'), "success");
  };

  const handleCopyInviteLink = async () => {
    if (!group) return;
    const link = `https://suhoorapp.cv/groups?groupKey=${group.group_key}`;
    await Clipboard.setStringAsync(link);
    triggerToast(t('groups.inviteLinkCopied'), "success");
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast
        message={toastMsg}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('groups.groupSettings', 'Group Settings')}</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Group Info Section */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('groups.groupInfo', 'Group Information')}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('groups.groupName', 'Group Name')}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{group?.name || groupName}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('groups.groupKey', 'Group Key')}</Text>
            <View style={styles.keyRow}>
              <Text style={[styles.infoValue, { color: colors.text }]}>{group?.group_key || groupKey}</Text>
              <TouchableOpacity onPress={handleCopyKey} style={styles.copyIcon}>
                <Ionicons name="copy-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Invite Section */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('groups.inviteSettings', 'Invite Settings')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.surfaceVariant }]}
            onPress={handleCopyInviteLink}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="copy-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.text }]}>{t('groups.copyInviteLink', 'Copy Invite Link')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.surfaceVariant }]}
            onPress={handleRegenerateInviteLink}
            disabled={regenerating}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="refresh-outline" size={20} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.text }]}>{t('groups.regenerateLink', 'Regenerate Link')}</Text>
            </View>
            {regenerating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            {t('groups.regenerateNote', 'Regenerating the link will create a new group key. The old link will no longer work.')}
          </Text>
        </View>

        {/* Additional Settings - Placeholder for future features */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('groups.advancedSettings', 'Advanced Settings')}</Text>
          </View>

          <View style={styles.comingSoon}>
            <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
              {t('groups.moreSettingsComing', 'More group settings coming soon...')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    columnGap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  copyIcon: {
    padding: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  noteText: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  comingSoon: {
    padding: 16,
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default GroupSettingsScreen;