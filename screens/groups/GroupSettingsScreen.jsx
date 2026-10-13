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
  Modal,
  FlatList,
} from 'react-native';
import {
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/firestoreSchema';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { Text } from '../../components/ui';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from '../../components/Toast';
import { copyToClipboard } from '../../utils/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GroupSettingsScreen = ({ route, navigation }) => {
  const {
    groupId,
    groupName,
    groupKey,
    isAdmin: initialIsAdmin,
    admins = [],
    allMembers: initialAllMembers = [],
  } = route.params || {};
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [group, setGroup] = useState(null);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin || false);
  const [allMembers, setAllMembers] = useState(
    Array.isArray(initialAllMembers) ? initialAllMembers : []
  );
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);

  // Group permissions state (WhatsApp style)
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(true);
  const [onlyAdminsInvite, setOnlyAdminsInvite] = useState(false);
  const [onlyAdminsBuzz, setOnlyAdminsBuzz] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(false);

  // Per-user group notification preference
  const [muteNotifications, setMuteNotifications] = useState(false);

  // Edit group name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(groupName || '');
  const [savingName, setSavingName] = useState(false);

  // Add Admin Modal state
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [updatingAdminId, setUpdatingAdminId] = useState(null);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');

  const triggerToast = (msg, type = 'info') => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // Derive admin and non-admin lists
  const adminList = allMembers.filter((m) => m?.role === 'admin');
  const regularMembers = allMembers.filter((m) => m?.role !== 'admin');

  // Load mute setting from AsyncStorage
  useEffect(() => {
    if (!groupId) return;
    AsyncStorage.getItem(`@suhoor_group_mute_${groupId}`)
      .then((val) => {
        if (val === 'true') setMuteNotifications(true);
      })
      .catch((_) => {});
  }, [groupId]);

  const handleToggleMute = async (val) => {
    setMuteNotifications(val);
    try {
      await AsyncStorage.setItem(`@suhoor_group_mute_${groupId}`, val ? 'true' : 'false');
      triggerToast(
        val ? 'Notifications muted for this group' : 'Notifications unmuted for this group',
        'info'
      );
    } catch (_) {}
  };

  const fetchGroupDetailsAndMembers = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      // 1. Fetch Group document
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      const groupSnap = await getDoc(groupRef);
      let data = null;
      if (groupSnap.exists()) {
        data = { id: groupSnap.id, ...groupSnap.data() };
        setGroup(data);
        setEditedName(data.name || groupName);
        setOnlyAdminsEdit(data.only_admins_edit ?? true);
        setOnlyAdminsInvite(data.only_admins_invite ?? false);
        setOnlyAdminsBuzz(data.only_admins_buzz ?? false);
        setRequireApproval(data.require_approval ?? false);
        setShowOnLeaderboard(data.show_on_leaderboard ?? false);
      }

      // 2. Fetch all members with profiles
      const membersRef = collection(db, COLLECTIONS.groupMembers);
      const q = query(membersRef, where('group_id', '==', groupId));
      const querySnapshot = await getDocs(q);

      const seen = new Map();
      for (const docSnap of querySnapshot.docs) {
        const memberData = docSnap.data();
        if (!memberData.user_id) continue;
        const existing = seen.get(memberData.user_id);
        if (existing && existing.role === 'admin') continue;

        const profileRef = doc(db, COLLECTIONS.profiles, memberData.user_id);
        const profileSnap = await getDoc(profileRef);

        seen.set(memberData.user_id, {
          id: docSnap.id,
          ...memberData,
          profiles: profileSnap.exists()
            ? { id: profileSnap.id, ...profileSnap.data() }
            : { id: memberData.user_id, display_name: 'Member' },
        });
      }

      const memberArray = [...seen.values()];
      setAllMembers(memberArray);

      // Determine if current user is admin
      if (currentUser) {
        if (data?.creator_id === currentUser.uid) {
          setIsAdmin(true);
        } else {
          const currentMembership = memberArray.find(
            (m) => m.user_id === currentUser.uid || m.profiles?.id === currentUser.uid
          );
          if (currentMembership) {
            setIsAdmin(currentMembership.role === 'admin');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching group details & members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetailsAndMembers();
  }, [groupId, currentUser]);

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
      t(
        'groups.regenerateLinkConfirm',
        'This will create a new invite link and group key. The old link will no longer work. Continue?'
      ),
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
    if (!isAdmin && onlyAdminsInvite) {
      triggerToast(t('groups.onlyAdminsCanInvite', 'Only admins can share the invite key'), 'info');
      return;
    }
    const key = group?.group_key || groupKey;
    if (!key) return;
    await copyToClipboard(key);
    triggerToast(t('groups.groupKeyCopied', 'Group code copied!'), 'success');
  };

  const handleCopyInviteLink = async () => {
    if (!isAdmin && onlyAdminsInvite) {
      triggerToast(t('groups.onlyAdminsCanInvite', 'Only admins can share the invite link'), 'info');
      return;
    }
    const key = group?.group_key || groupKey;
    if (!key) return;
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://suhoor-group.web.app';
    const link = `${origin}/groups?groupKey=${key}`;
    await copyToClipboard(link);
    triggerToast(t('groups.inviteLinkCopied', 'Invite link copied!'), 'success');
  };

  // Promote a member to admin (WhatsApp style)
  const handlePromoteToAdmin = (member) => {
    if (!isAdmin || !member?.id) return;
    const memberName =
      member.profiles?.display_name || member.profiles?.email || 'this member';

    Alert.alert(
      'Make Group Admin',
      `Add "${memberName}" as an admin of this group? They will be able to edit group info and manage group settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Admin',
          onPress: async () => {
            setUpdatingAdminId(member.id);
            try {
              const memberRef = doc(db, COLLECTIONS.groupMembers, member.id);
              await updateDoc(memberRef, {
                role: 'admin',
                updated_at: serverTimestamp(),
              });
              setAllMembers((prev) =>
                prev.map((m) => (m.id === member.id ? { ...m, role: 'admin' } : m))
              );
              setShowAddAdminModal(false);
              triggerToast(`${memberName} is now a group admin!`, 'success');
            } catch (err) {
              console.error('Error promoting member to admin:', err);
              triggerToast('Failed to assign admin permissions', 'error');
            } finally {
              setUpdatingAdminId(null);
            }
          },
        },
      ]
    );
  };

  // Demote/dismiss a co-admin (WhatsApp style)
  const handleDismissAdmin = (adminMember) => {
    if (!isAdmin || !adminMember?.id) return;
    const isSelf =
      adminMember.user_id === currentUser?.uid ||
      adminMember.profiles?.id === currentUser?.uid;

    if (isSelf) {
      Alert.alert(
        'Cannot Dismiss Yourself',
        'You cannot dismiss yourself as admin. If you wish to leave, use Leave Group or transfer ownership.'
      );
      return;
    }

    if (adminList.length <= 1) {
      Alert.alert(
        'Action Not Allowed',
        'A group must have at least one admin. Add another admin first before removing this one.'
      );
      return;
    }

    const adminName =
      adminMember.profiles?.display_name || adminMember.profiles?.email || 'this admin';

    Alert.alert(
      'Dismiss as Admin',
      `Remove admin permissions from "${adminName}"? They will remain a regular member of the group.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            setUpdatingAdminId(adminMember.id);
            try {
              const memberRef = doc(db, COLLECTIONS.groupMembers, adminMember.id);
              await updateDoc(memberRef, {
                role: 'member',
                updated_at: serverTimestamp(),
              });
              setAllMembers((prev) =>
                prev.map((m) => (m.id === adminMember.id ? { ...m, role: 'member' } : m))
              );
              triggerToast(`${adminName} is no longer an admin`, 'info');
            } catch (err) {
              console.error('Error dismissing admin:', err);
              triggerToast('Failed to remove admin status', 'error');
            } finally {
              setUpdatingAdminId(null);
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    if (!currentUser) return;
    if (isAdmin && adminList.length === 1) {
      Alert.alert(
        t('common.cannotLeave', 'Cannot Leave'),
        t(
          'groups.cannotLeaveAsAdmin',
          'You are the sole admin. Please appoint another member as admin first, or use Disband Group to permanently delete this group.'
        )
      );
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

  const handleDeleteGroup = () => {
    if (!currentUser || !isAdmin) return;
    Alert.alert(
      t('groups.deleteGroup', 'Disband & Delete Group'),
      t(
        'groups.deleteGroupConfirm',
        'Are you sure you want to permanently delete this group? All members will be removed and this action cannot be undone.'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete Group'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const membersRef = collection(db, COLLECTIONS.groupMembers);
              const q = query(membersRef, where('group_id', '==', groupId));
              const snap = await getDocs(q);
              const deletes = snap.docs.map((d) => deleteDoc(d.ref));
              await Promise.all(deletes);

              await deleteDoc(doc(db, COLLECTIONS.groups, groupId));
              triggerToast(t('groups.groupDeleted', 'Group deleted successfully'), 'success');
              navigation.navigate('GroupsList');
            } catch (err) {
              console.error('Error deleting group:', err);
              triggerToast(t('groups.deleteGroupError', 'Failed to delete group'), 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading && !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Filter candidates for adding as admin
  const candidateMembers = regularMembers.filter((m) => {
    if (!adminSearch.trim()) return true;
    const name = (m.profiles?.display_name || '').toLowerCase();
    const email = (m.profiles?.email || '').toLowerCase();
    return (
      name.includes(adminSearch.toLowerCase()) ||
      email.includes(adminSearch.toLowerCase())
    );
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast
        message={toastMsg}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('groups.groupSettings', 'Group Settings')}
        </Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Group Info Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('groups.groupInfo', 'Group Information')}
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {t('groups.groupName', 'Group Name')}
            </Text>
            {isEditingName ? (
              <View style={styles.editRow}>
                <TextInput
                  value={editedName}
                  onChangeText={setEditedName}
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={handleSaveName}
                  disabled={savingName}
                  style={styles.saveBtn}
                >
                  {savingName ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsEditingName(false)}
                  style={styles.cancelBtn}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.nameDisplayRow}>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {group?.name || groupName}
                </Text>
                {(isAdmin || !onlyAdminsEdit) && (
                  <TouchableOpacity
                    onPress={() => setIsEditingName(true)}
                    style={styles.editIcon}
                  >
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {t('groups.groupKey', 'Group Code')}
            </Text>
            <View style={styles.keyRow}>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {group?.group_key || groupKey}
              </Text>
              <TouchableOpacity onPress={handleCopyKey} style={styles.copyIcon}>
                <Ionicons name="copy-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Invite & Share Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('groups.inviteSettings', 'Invite & Sharing')}
            </Text>
          </View>

          {!isAdmin && onlyAdminsInvite ? (
            <View
              style={[
                styles.actionRow,
                { backgroundColor: colors.surfaceVariant, paddingVertical: 12 },
              ]}
            >
              <Ionicons
                name="lock-closed"
                size={18}
                color={colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
                {t(
                  'groups.inviteRestricted',
                  'Invite code & link sharing is restricted to group admins.'
                )}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionRow,
                { backgroundColor: colors.surfaceVariant },
              ]}
              onPress={handleCopyInviteLink}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.text }]}>
                  {t('groups.copyInviteLink', 'Copy Invite Link')}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.actionRow,
                { backgroundColor: colors.surfaceVariant },
              ]}
              onPress={handleRegenerateInviteLink}
              disabled={regenerating}
            >
              <View style={styles.actionLeft}>
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={colors.accent || colors.primary}
                />
                <Text style={[styles.actionText, { color: colors.text }]}>
                  {t('groups.regenerateLink', 'Regenerate Invite Link')}
                </Text>
              </View>
              {regenerating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textSecondary}
                />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ======================================================== */}
        {/* GROUP ADMINS SECTION (Visible to BOTH Admins & Users)    */}
        {/* ======================================================== */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Group Admins ({adminList.length})
              </Text>
            </View>

            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.addAdminBtn,
                  { backgroundColor: colors.primary + '18' },
                ]}
                onPress={() => setShowAddAdminModal(true)}
              >
                <Ionicons name="person-add" size={14} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: '700',
                    marginLeft: 4,
                  }}
                >
                  Add Admin
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {adminList.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 8 }}>
              No admins assigned yet.
            </Text>
          ) : (
            adminList.map((adminMember, index) => {
              const displayName =
                adminMember.profiles?.display_name ||
                adminMember.profiles?.email?.split('@')[0] ||
                'Admin';
              const initial = displayName.charAt(0).toUpperCase();
              const isCurrentUserItem =
                adminMember.user_id === currentUser?.uid ||
                adminMember.profiles?.id === currentUser?.uid;

              return (
                <View
                  key={adminMember.id || index}
                  style={[
                    styles.adminMemberRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: index === adminList.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={styles.adminMemberLeft}>
                    <View
                      style={[
                        styles.adminAvatar,
                        { backgroundColor: colors.primary + '20' },
                      ]}
                    >
                      <Text
                        style={[styles.adminAvatarText, { color: colors.primary }]}
                      >
                        {initial}
                      </Text>
                    </View>
                    <View style={styles.adminMemberInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
                        <Text
                          style={[styles.adminMemberName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        {isCurrentUserItem && (
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.textSecondary,
                              fontStyle: 'italic',
                            }}
                          >
                            (You)
                          </Text>
                        )}
                      </View>
                      {adminMember.profiles?.email && (
                        <Text
                          style={[
                            styles.adminMemberEmail,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {adminMember.profiles.email}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
                    <View
                      style={[
                        styles.adminBadge,
                        { backgroundColor: colors.success + '18' },
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark"
                        size={11}
                        color={colors.success}
                      />
                      <Text
                        style={[styles.adminBadgeText, { color: colors.success }]}
                      >
                        Admin
                      </Text>
                    </View>

                    {isAdmin && !isCurrentUserItem && (
                      <TouchableOpacity
                        onPress={() => handleDismissAdmin(adminMember)}
                        disabled={updatingAdminId === adminMember.id}
                        style={styles.dismissBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {updatingAdminId === adminMember.id ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>
                            Dismiss
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ======================================================== */}
        {/* GROUP PERMISSIONS / ADMIN CONTROLS (WhatsApp style)       */}
        {/* ======================================================== */}
        {isAdmin ? (
          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="settings" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('groups.adminControls', 'Group Permissions (Admin Controls)')}
              </Text>
            </View>

            {/* Edit Group Info Permission */}
            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View style={styles.switchLabelBlock}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>
                  {t('groups.editGroupSettings', 'Edit Group Settings')}
                </Text>
                <Text
                  style={[styles.switchSub, { color: colors.textSecondary }]}
                >
                  {onlyAdminsEdit
                    ? t('groups.adminsOnly', 'Only admins can change group name & photo')
                    : t('groups.allMembers', 'All members can change group name & photo')}
                </Text>
              </View>
              <Switch
                value={onlyAdminsEdit}
                disabled={isUpdatingSetting}
                onValueChange={(val) => {
                  setOnlyAdminsEdit(val);
                  handleUpdateSetting('only_admins_edit', val);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={onlyAdminsEdit ? colors.secondary : '#f4f3f4'}
              />
            </View>

            {/* Who can send Buzz / Wake-up Alerts */}
            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View style={styles.switchLabelBlock}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>
                  Send Wake-Up Buzzes
                </Text>
                <Text
                  style={[styles.switchSub, { color: colors.textSecondary }]}
                >
                  {onlyAdminsBuzz
                    ? 'Only admins can buzz and wake up members'
                    : 'All members can buzz and wake up fellow fasters'}
                </Text>
              </View>
              <Switch
                value={onlyAdminsBuzz}
                disabled={isUpdatingSetting}
                onValueChange={(val) => {
                  setOnlyAdminsBuzz(val);
                  handleUpdateSetting('only_admins_buzz', val);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={onlyAdminsBuzz ? colors.secondary : '#f4f3f4'}
              />
            </View>

            {/* Add Members Permission */}
            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View style={styles.switchLabelBlock}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>
                  {t('groups.addMembers', 'Invite & Add Members')}
                </Text>
                <Text
                  style={[styles.switchSub, { color: colors.textSecondary }]}
                >
                  {onlyAdminsInvite
                    ? t('groups.adminsOnlyInvite', 'Only admins can share invite code')
                    : t('groups.allMembersInvite', 'All members can share invite code')}
                </Text>
              </View>
              <Switch
                value={onlyAdminsInvite}
                disabled={isUpdatingSetting}
                onValueChange={(val) => {
                  setOnlyAdminsInvite(val);
                  handleUpdateSetting('only_admins_invite', val);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={onlyAdminsInvite ? colors.secondary : '#f4f3f4'}
              />
            </View>

            {/* Show on Leaderboard */}
            <View style={styles.switchRow}>
              <View style={styles.switchLabelBlock}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>
                  {t('groups.leaderboardVisibility', 'Global Leaderboard')}
                </Text>
                <Text
                  style={[styles.switchSub, { color: colors.textSecondary }]}
                >
                  {showOnLeaderboard
                    ? t('groups.leaderboardOn', 'Group appears on global Leaderboard')
                    : t('groups.leaderboardOff', 'Group is hidden from global Leaderboard')}
                </Text>
              </View>
              <Switch
                value={showOnLeaderboard}
                disabled={isUpdatingSetting}
                onValueChange={(val) => {
                  setShowOnLeaderboard(val);
                  handleUpdateSetting('show_on_leaderboard', val);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={showOnLeaderboard ? colors.secondary : '#f4f3f4'}
              />
            </View>
          </View>
        ) : (
          /* Regular Member: Group Rules & Permissions overview */
          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons
                name="shield-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('groups.groupRules', 'Group Rules & Permissions')}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Editing Group Info
              </Text>
              <Text
                style={[styles.infoValue, { color: colors.text, fontSize: 13 }]}
              >
                {onlyAdminsEdit ? 'Admins Only' : 'All Members'}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Wake-Up Buzzes
              </Text>
              <Text
                style={[styles.infoValue, { color: colors.text, fontSize: 13 }]}
              >
                {onlyAdminsBuzz ? 'Admins Only' : 'All Members'}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Inviting New Members
              </Text>
              <Text
                style={[styles.infoValue, { color: colors.text, fontSize: 13 }]}
              >
                {onlyAdminsInvite ? 'Admins Only' : 'All Members'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Global Leaderboard
              </Text>
              <Text
                style={[styles.infoValue, { color: colors.text, fontSize: 13 }]}
              >
                {showOnLeaderboard ? 'Visible' : 'Hidden'}
              </Text>
            </View>
          </View>
        )}

        {/* Notifications & Personal Preference */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Group Notifications
            </Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelBlock}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>
                Mute Wake-Up Buzzes
              </Text>
              <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                Silence incoming alarms and buzzes from this group
              </Text>
            </View>
            <Switch
              value={muteNotifications}
              onValueChange={handleToggleMute}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={muteNotifications ? colors.secondary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Danger Zone Actions */}
        {!isAdmin ? (
          <TouchableOpacity
            style={[
              styles.leaveBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(239, 68, 68, 0.08)',
                borderColor: isDark
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(239, 68, 68, 0.2)',
              },
            ]}
            onPress={handleLeaveGroup}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.leaveBtnText, { color: colors.error }]}>
              {t('groups.leaveGroup', 'Leave Group')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.leaveBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(239, 68, 68, 0.08)',
                borderColor: isDark
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(239, 68, 68, 0.2)',
              },
            ]}
            onPress={handleDeleteGroup}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.leaveBtnText, { color: colors.error }]}>
              {t('groups.deleteGroup', 'Disband & Delete Group')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ======================================================== */}
      {/* ADD GROUP ADMIN MODAL (WhatsApp style)                   */}
      {/* ======================================================== */}
      <Modal
        visible={showAddAdminModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddAdminModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Add Group Admin
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Select a member to grant admin permissions
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddAdminModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search filter input */}
            <View
              style={[
                styles.modalSearchBox,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.textSecondary}
              />
              <TextInput
                value={adminSearch}
                onChangeText={setAdminSearch}
                placeholder="Search member name or email..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.modalSearchInput, { color: colors.text }]}
              />
            </View>

            {candidateMembers.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Ionicons
                  name="people-outline"
                  size={44}
                  color={colors.textSecondary}
                />
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    marginTop: 10,
                  }}
                >
                  {regularMembers.length === 0
                    ? 'All group members are already admins.'
                    : 'No matching members found.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={candidateMembers}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 340 }}
                renderItem={({ item }) => {
                  const name =
                    item.profiles?.display_name ||
                    item.profiles?.email?.split('@')[0] ||
                    'Member';
                  const initial = name.charAt(0).toUpperCase();

                  return (
                    <TouchableOpacity
                      style={[
                        styles.candidateRow,
                        { borderBottomColor: colors.border },
                      ]}
                      onPress={() => handlePromoteToAdmin(item)}
                      disabled={updatingAdminId === item.id}
                    >
                      <View style={styles.adminMemberLeft}>
                        <View
                          style={[
                            styles.adminAvatar,
                            { backgroundColor: colors.primary + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.adminAvatarText,
                              { color: colors.primary },
                            ]}
                          >
                            {initial}
                          </Text>
                        </View>
                        <View style={styles.adminMemberInfo}>
                          <Text
                            style={[
                              styles.adminMemberName,
                              { color: colors.text },
                            ]}
                          >
                            {name}
                          </Text>
                          {item.profiles?.email && (
                            <Text
                              style={[
                                styles.adminMemberEmail,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {item.profiles.email}
                            </Text>
                          )}
                        </View>
                      </View>

                      {updatingAdminId === item.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <View
                          style={[
                            styles.makeAdminBtn,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Text
                            style={{
                              color: colors.onPrimaryFill || '#fff',
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            Make Admin
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
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
  // Admin list styling
  addAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  adminMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  adminMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    flex: 1,
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAvatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  adminMemberInfo: {
    flex: 1,
  },
  adminMemberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  adminMemberEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  // Add Admin Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
    columnGap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  makeAdminBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
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