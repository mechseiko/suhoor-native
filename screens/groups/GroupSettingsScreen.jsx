import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Switch,
  TextInput,
} from 'react-native';
import { doc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/firestoreSchema';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { Text } from '../../components/ui';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from '../../components/Toast';
import * as Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GroupSettingsScreen = ({ route, navigation }) => {
  const { groupId, groupName, groupKey, isAdmin: initialIsAdmin, admins = [] } = route.params || {};
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [group, setGroup] = useState(null);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin || false);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);

  // Group permissions state
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(true);
  const [onlyAdminsInvite, setOnlyAdminsInvite] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(false);

  // Per-user group notification preference
  const [muteNotifications, setMuteNotifications] = useState(false);

  // Edit group name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(groupName || '');
  const [savingName, setSavingName] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');

  const triggerToast = (msg, type = 'info') => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchGroupDetails = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const data = { id: groupSnap.id, ...groupSnap.data() };
        setGroup(data);
        setEditedName(data.name || groupName);
        setOnlyAdminsEdit(data.only_admins_edit ?? true);
        setOnlyAdminsInvite(data.only_admins_invite ?? false);
        setRequireApproval(data.require_approval ?? false);
        setShowOnLeaderboard(data.show_on_leaderboard ?? false);
      }

      // Check current user role if not passed
      if (currentUser) {
        const memberRef = doc(db, COLLECTIONS.groupMembers, `${groupId}_${currentUser.uid}`);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          setIsAdmin(memberSnap.data().role === 'admin');
        }
      }

      // Check per-user group mute status
      const muteKey = `group_mute_${groupId}`;
      const isMuted = await AsyncStorage.getItem(muteKey);
      setMuteNotifications(isMuted === 'true');
    } catch (err) {
      console.error('Error fetching group details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (field, value) => {
    if (!groupId || !isAdmin) return;
    setIsUpdatingSetting(true);
    try {
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      await updateDoc(groupRef, {
        [field]: value,
        updated_at: serverTimestamp(),
      });
      setGroup((prev) => ({ ...prev, [field]: value }));
      triggerToast(t('groups.settingsUpdated', 'Setting updated'), 'success');
    } catch (err) {
      console.error('Error updating setting:', err);
      triggerToast(t('groups.settingsUpdateError', 'Failed to update setting'), 'error');
    } finally {
      setIsUpdatingSetting(false);
    }
  };

  const handleToggleMute = async (value) => {
    setMuteNotifications(value);
    try {
      const muteKey = `group_mute_${groupId}`;
      if (value) {
        await AsyncStorage.setItem(muteKey, 'true');
        triggerToast(t('groups.notificationsMuted', 'Notifications muted for this group'), 'info');
      } else {
        await AsyncStorage.removeItem(muteKey);
        triggerToast(t('groups.notificationsUnmuted', 'Notifications enabled for this group'), 'success');
      }
    } catch (e) {
      console.error('Error saving notification preference:', e);
    }
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || !groupId) return;
    if (!isAdmin && onlyAdminsEdit) {
      triggerToast(t('groups.adminOnlyEdit', 'Only admins can edit the group name'), 'error');
      return;
    }
    setSavingName(true);
    try {
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      await updateDoc(groupRef, {
        name: editedName.trim(),
        updated_at: serverTimestamp(),
      });
      setGroup((prev) => ({ ...prev, name: editedName.trim() }));
      setIsEditingName(false);
      triggerToast(t('groups.nameUpdated', 'Group name updated!'), 'success');
    } catch (err) {
      console.error('Error saving group name:', err);
      triggerToast(t('groups.nameUpdateError', 'Failed to update name'), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handleRegenerateInviteLink = async () => {
    if (!group || !isAdmin) return;
    Alert.alert(
      t('groups.regenerateLinkTitle', 'Regenerate Invite Link'),
      t('groups.regenerateLinkConfirm', 'This will create a new invite link and group key. The old link will no longer work. Continue?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('groups.regenerate', 'Regenerate'),
          style: 'destructive',
          onPress: async () => {
            setRegenerating(true);
            try {
              const newKey = Math.random().toString(36).substring(2, 10).toUpperCase();
              const groupRef = doc(db, COLLECTIONS.groups, groupId);
              await updateDoc(groupRef, {
                group_key: newKey,
                key_generated_at: serverTimestamp(),
              });
              setGroup((prev) => ({ ...prev, group_key: newKey }));
              triggerToast(t('groups.linkRegenerated', 'Invite link regenerated!'), 'success');
            } catch (err) {
              console.error('Error regenerating invite link:', err);
              triggerToast(t('groups.regenerateError', 'Failed to regenerate invite link.'), 'error');
            } finally {
              setRegenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleCopyKey = async () => {
    const key = group?.group_key || groupKey;
    if (!key) return;
    if (Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(key);
    } else if (Clipboard.setString) {
      Clipboard.setString(key);
    }
    triggerToast(t('groups.groupKeyCopied', 'Group code copied!'), 'success');
  };

  const handleCopyInviteLink = async () => {
    const key = group?.group_key || groupKey;
    if (!key) return;
    const link = `https://suhoorapp.cv/groups?groupKey=${key}`;
    if (Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(link);
    } else if (Clipboard.setString) {
      Clipboard.setString(link);
    }
    triggerToast(t('groups.inviteLinkCopied', 'Invite link copied!'), 'success');
  };

  const handleContactAdmin = () => {
    const adminNames = admins.map((a) => a?.profiles?.display_name || a?.profiles?.email || 'Admin').join(', ');
    Alert.alert(
      t('groups.groupAdmins', 'Group Admins'),
      adminNames ? `Admins: ${adminNames}` : t('groups.noAdminFound', 'No admin found'),
      [{ text: t('common.ok', 'OK') }]
    );
  };

  const handleLeaveGroup = () => {
    if (!currentUser) return;
    if (isAdmin) {
      Alert.alert(t('common.cannotLeave', 'Cannot Leave'), t('groups.cannotLeaveAsAdmin', 'Admins cannot leave without assigning another admin.'));
      return;
    }
    Alert.alert(
      t('groups.leave', 'Leave Group'),
      t('groups.leaveGroupConfirm', 'Are you sure you want to leave this group?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('groups.leave', 'Leave'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const membersRef = collection(db, COLLECTIONS.groupMembers);
              const q = query(
                membersRef,
                where('group_id', '==', groupId),
                where('user_id', '==', currentUser.uid)
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                await deleteDoc(doc(db, COLLECTIONS.groupMembers, snap.docs[0].id));
              }
              triggerToast(t('groups.leftGroup', 'You have left the group'), 'success');
              navigation.navigate('GroupsList');
            } catch (err) {
              console.error(err);
              triggerToast(t('groups.leaveGroupError', 'Failed to leave group'), 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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

          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('groups.groupName', 'Group Name')}</Text>
            {isEditingName ? (
              <View style={styles.editRow}>
                <TextInput
                  value={editedName}
                  onChangeText={setEditedName}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  autoFocus
                />
                <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={styles.saveBtn}>
                  {savingName ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsEditingName(false)} style={styles.cancelBtn}>
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.nameDisplayRow}>
                <Text style={[styles.infoValue, { color: colors.text }]}>{group?.name || groupName}</Text>
                {(isAdmin || !onlyAdminsEdit) && (
                  <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.editIcon}>
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('groups.groupKey', 'Group Code')}</Text>
            <View style={styles.keyRow}>
              <Text style={[styles.infoValue, { color: colors.text }]}>{group?.group_key || groupKey}</Text>
              <TouchableOpacity onPress={handleCopyKey} style={styles.copyIcon}>
                <Ionicons name="copy-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Invite & Share Section */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('groups.inviteSettings', 'Invite & Sharing')}</Text>
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

          {isAdmin && (
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.surfaceVariant }]}
              onPress={handleRegenerateInviteLink}
              disabled={regenerating}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="refresh-outline" size={20} color={colors.accent} />
                <Text style={[styles.actionText, { color: colors.text }]}>{t('groups.regenerateLink', 'Regenerate Invite Link')}</Text>
              </View>
              {regenerating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Group Permissions (Admin Controls) */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {isAdmin ? t('groups.adminControls', 'Group Permissions (Admin Controls)') : t('groups.groupPermissions', 'Group Permissions')}
            </Text>
          </View>

          {/* Edit Group Info Permission */}
          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchLabelBlock}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>{t('groups.editGroupSettings', 'Edit Group Settings')}</Text>
              <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                {onlyAdminsEdit ? t('groups.adminsOnly', 'Only admins can edit name and info') : t('groups.allMembers', 'All members can edit name and info')}
              </Text>
            </View>
            <Switch
              value={onlyAdminsEdit}
              disabled={!isAdmin || isUpdatingSetting}
              onValueChange={(val) => {
                setOnlyAdminsEdit(val);
                handleUpdateSetting('only_admins_edit', val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={onlyAdminsEdit ? colors.secondary : '#f4f3f4'}
            />
          </View>

          {/* Add Members Permission */}
          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchLabelBlock}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>{t('groups.addMembers', 'Invite & Add Members')}</Text>
              <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                {onlyAdminsInvite ? t('groups.adminsOnlyInvite', 'Only admins can share invite code') : t('groups.allMembersInvite', 'All members can share invite code')}
              </Text>
            </View>
            <Switch
              value={onlyAdminsInvite}
              disabled={!isAdmin || isUpdatingSetting}
              onValueChange={(val) => {
                setOnlyAdminsInvite(val);
                handleUpdateSetting('only_admins_invite', val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={onlyAdminsInvite ? colors.secondary : '#f4f3f4'}
            />
          </View>

          {/* Approve New Members */}
          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchLabelBlock}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>{t('groups.approveNewMembers', 'Approve New Members')}</Text>
              <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                {requireApproval ? t('groups.approvalOn', 'Admins must manually approve new joins') : t('groups.approvalOff', 'Anyone with the invite code joins immediately')}
              </Text>
            </View>
            <Switch
              value={requireApproval}
              disabled={!isAdmin || isUpdatingSetting}
              onValueChange={(val) => {
                setRequireApproval(val);
                handleUpdateSetting('require_approval', val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={requireApproval ? colors.secondary : '#f4f3f4'}
            />
          </View>

          {/* Show on Leaderboard */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBlock}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>{t('groups.leaderboardVisibility', 'Global Leaderboard')}</Text>
              <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                {showOnLeaderboard ? t('groups.leaderboardOn', 'Group appears on global Leaderboard') : t('groups.leaderboardOff', 'Group is hidden from global Leaderboard')}
              </Text>
            </View>
            <Switch
              value={showOnLeaderboard}
              disabled={!isAdmin || isUpdatingSetting}
              onValueChange={(val) => {
                setShowOnLeaderboard(val);
                handleUpdateSetting('show_on_leaderboard', val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={showOnLeaderboard ? colors.secondary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Preferences & Privacy */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('groups.preferences', 'Preferences & Notifications')}</Text>
          </View>

          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchLabelBlock}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>{t('groups.muteGroup', 'Mute Group Buzzes')}</Text>
              <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                {muteNotifications ? t('groups.mutedNotice', 'Buzz alerts from this group are silenced') : t('groups.unmutedNotice', 'Receive wake-up alerts from this group')}
              </Text>
            </View>
            <Switch
              value={muteNotifications}
              onValueChange={handleToggleMute}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={muteNotifications ? colors.secondary : '#f4f3f4'}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.surfaceVariant, marginTop: 8 }]}
            onPress={handleContactAdmin}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.text }]}>{t('groups.contactAdmin', 'Contact Group Admin')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Leave Group Action */}
        {!isAdmin && (
          <TouchableOpacity
            style={[styles.leaveBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)' }]}
            onPress={handleLeaveGroup}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.leaveBtnText, { color: colors.error }]}>{t('groups.leaveGroup', 'Leave Group')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
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
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  editIcon: {
    padding: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    maxWidth: 160,
  },
  saveBtn: {
    padding: 4,
  },
  cancelBtn: {
    padding: 4,
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
    padding: 14,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  switchLabelBlock: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  switchSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  leaveBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GroupSettingsScreen;