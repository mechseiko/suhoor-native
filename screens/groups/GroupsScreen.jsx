import React, { useState, useEffect, useRef } from 'react'
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native'
import { Text } from '../../components/ui'
import { copyToClipboard } from '../../utils/clipboard'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { useFastingTimes } from '../../hooks/useFastingTimes'
import { db } from '../../config/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Ionicons from 'react-native-vector-icons/Ionicons'
import Toast from '../../components/Toast'
import { useSocket } from '../../context/SocketContext'

export const GroupsScreen = ({ navigation }) => {
  const { currentUser, userProfile } = useAuth()
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const { todayData } = useFastingTimes()
  const { emitWakeUp } = useSocket()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Wake-up window and check-in state
  const [isInWakeUpWindow, setIsInWakeUpWindow] = useState(false)
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false)
  const [wantsToFast, setWantsToFast] = useState(true)

  const [showPinModal, setShowPinModal] = useState(false)
  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState('')
  const pinRefs = [useRef(), useRef(), useRef(), useRef()]

  // Modals state
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Form states
  const [newGroupName, setNewGroupName] = useState('')
  const [joinGroupKey, setJoinGroupKey] = useState('')
  const [modalLoading, setModalLoading] = useState(false)

  // Toast state
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')

  // Copied indicator state
  const [copiedId, setCopiedId] = useState(null)

  const triggerToast = (msg, type) => {
    setToastMsg(msg)
    setToastType(type)
    setToastVisible(true)
  }

  // Calculate wake-up window
  useEffect(() => {
    if (!currentUser || !todayData?.time?.sahur) return

    const checkTime = () => {
      const now = new Date()
      const profile = userProfile
      
      let targetHour, targetMinute
      
      if (profile?.customWakeUpTime) {
        [targetHour, targetMinute] = profile.customWakeUpTime.split(':').map(Number)
      } else {
        const [suhoorH, suhoorM] = todayData.time.sahur.split(':').map(Number)
        const suhoorTime = new Date()
        suhoorTime.setHours(suhoorH, suhoorM, 0, 0)
        suhoorTime.setMinutes(suhoorTime.getMinutes() - 45) // 45 mins before suhoor
        targetHour = suhoorTime.getHours()
        targetMinute = suhoorTime.getMinutes()
      }

      const targetTime = new Date()
      targetTime.setHours(targetHour, targetMinute, 0, 0)
      if (targetTime < now && now.getHours() > 12) {
        targetTime.setDate(targetTime.getDate() + 1)
      }

      const [suhoorH, suhoorM] = todayData.time.sahur.split(':').map(Number)
      const endTime = new Date()
      endTime.setHours(suhoorH, suhoorM, 0, 0)
      if (endTime < now && now.getHours() > 12) {
        endTime.setDate(endTime.getDate() + 1)
      }

      const active = now >= targetTime && now <= endTime
      setIsInWakeUpWindow(active)
    }

    const interval = setInterval(checkTime, 10000)
    checkTime()
    return () => clearInterval(interval)
  }, [currentUser, userProfile, todayData])

  // Check if user has checked in today
  useEffect(() => {
    if (!currentUser) return

    const fetchTodayCheckIn = async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')
        const logsRef = collection(db, 'wake_up_logs')
        const q = query(
          logsRef,
          where('user_id', '==', currentUser.uid),
          where('date', '==', today)
        )
        const snapshot = await getDocs(q)
        setHasCheckedInToday(!snapshot.empty)
      } catch (err) {
        console.error('Error fetching check-in status:', err)
      }
    }

    fetchTodayCheckIn()
  }, [currentUser])

  // Fetch fasting intention for today
  useEffect(() => {
    if (!currentUser) return

    const fetchFastingIntention = async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')
        const docRef = doc(db, 'daily_fasting_status', `${currentUser.uid}_${today}`)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setWantsToFast(docSnap.data().wantsToFast !== false)
        }
      } catch (err) {
        console.error('Error fetching fasting intention:', err)
      }
    }

    fetchFastingIntention()
  }, [currentUser])

  // Handle direct 1-tap check-in on the Groups tab
  const handleDirectCheckIn = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const todayStr = new Date().toLocaleDateString('en-CA')
      const wakeUpTime = new Date().toISOString()

      // Add wake up log
      await addDoc(collection(db, 'wake_up_logs'), {
        user_id: currentUser.uid,
        date: todayStr,
        woke_up_at: wakeUpTime,
      })

      // Update daily_fasting_status to record completion
      const statusRef = doc(db, 'daily_fasting_status', `${currentUser.uid}_${todayStr}`)
      await setDoc(statusRef, {
        userId: currentUser.uid,
        date: todayStr,
        wantsToFast: true,
        checkedIn: true,
        wokeUpAt: wakeUpTime,
      }, { merge: true })

      // Notify all current groups via socket
      if (emitWakeUp && groups.length > 0) {
        const userName =
          userProfile?.display_name ||
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          'Member'
        groups.forEach(g => {
          emitWakeUp(g.id, userName, wakeUpTime)
        })
      }

      setHasCheckedInToday(true)
      triggerToast("Check-in successful! You're awake.", 'success')
    } catch (err) {
      console.error('Error in check-in:', err)
      triggerToast('Failed to check in. Try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle check-in with PIN verification
  const handleCheckIn = async () => {
    if (!currentUser) return

    // Read saved PIN from AsyncStorage
    let savedPin = ''
    try {
      savedPin = (await AsyncStorage.getItem('suhoor_alarm_pin')) || ''
    } catch {}

    const entered = pinDigits.join('')
    if (entered.length < 4) {
      setPinError('Enter your 4-digit alarm PIN.')
      return
    }
    if (savedPin && entered !== savedPin) {
      setPinError('Incorrect PIN. Try again.')
      setPinDigits(['', '', '', ''])
      setTimeout(() => pinRefs[0]?.current?.focus(), 100)
      return
    }

    setShowPinModal(false)
    await handleDirectCheckIn()
  }

  const openPinModal = () => {
    setPinDigits(['', '', '', ''])
    setPinError('')
    setShowPinModal(true)
    setTimeout(() => pinRefs[0]?.current?.focus(), 200)
  }

  const handlePinDigit = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const next = [...pinDigits]
    next[index] = digit
    setPinDigits(next)
    setPinError('')
    if (digit && index < 3) {
      pinRefs[index + 1]?.current?.focus()
    }
    if (digit && index === 3) {
      // auto-submit
      const entered = [...next.slice(0, 3), digit].join('')
      handlePinSubmit(entered)
    }
  }

  const handlePinKeyDown = (index, e) => {
    if (e.nativeEvent?.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1]?.current?.focus()
    }
  }

  const handlePinSubmit = async (overridePin) => {
    const entered = overridePin ?? pinDigits.join('')
    if (entered.length < 4) {
      setPinError('Enter your 4-digit alarm PIN.')
      return
    }
    let savedPin = ''
    try {
      savedPin = (await AsyncStorage.getItem('suhoor_alarm_pin')) || ''
    } catch {}
    if (savedPin && entered !== savedPin) {
      setPinError('Incorrect PIN. Try again.')
      setPinDigits(['', '', '', ''])
      setTimeout(() => pinRefs[0]?.current?.focus(), 100)
      return
    }
    handleCheckIn()
  }

  const fetchGroups = async () => {
    if (!currentUser) return
    try {
      console.log('[GroupsScreen] Fetching groups for user:', currentUser.uid);
      
      const membersRef = collection(db, 'group_members')
      const q = query(membersRef, where('user_id', '==', currentUser.uid))
      const querySnapshot = await getDocs(q)

      console.log('[GroupsScreen] Group members query result size:', querySnapshot.size);

      const groupIds = []
      querySnapshot.forEach(doc => {
        groupIds.push(doc.data().group_id)
      })

      console.log('[GroupsScreen] Group IDs:', groupIds);

      const groupsData = []
      for (const groupId of groupIds) {
        const groupRef = doc(db, 'groups', groupId)
        const groupSnap = await getDoc(groupRef)
        if (groupSnap.exists()) {
          // Fetch member count
          const memberCountQuery = query(
            membersRef,
            where('group_id', '==', groupId)
          )
          const memberCountSnap = await getDocs(memberCountQuery)

          groupsData.push({
            id: groupSnap.id,
            name: groupSnap.data().name || 'Unnamed Group',
            group_key: groupSnap.data().group_key || '',
            member_count: memberCountSnap.size,
          })
        }
      }
      setGroups(groupsData)
      console.log('[GroupsScreen] Groups data loaded:', groupsData);
    } catch (err) {
      console.error('[GroupsScreen] Error fetching groups:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [currentUser])

  const onRefresh = () => {
    setRefreshing(true)
    fetchGroups()
  }

  const handleCopyKey = async group => {
    await copyToClipboard(group.group_key)
    setCopiedId(group.id)
    triggerToast(t('groups.copiedSuccess'), 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCreateGroup = async () => {
    if (!currentUser) return
    if (!newGroupName.trim()) {
      triggerToast(t('groups.enterNameError'), 'error')
      return
    }
    if (newGroupName.trim().length > 30) {
      triggerToast(t('groups.nameLengthError'), 'error')
      return
    }

    setModalLoading(true)
    try {
      // 8-character unique uppercase key
      const key = Math.random().toString(36).substring(2, 10).toUpperCase()

      const groupRef = doc(collection(db, 'groups'))
      await setDoc(groupRef, {
        name: newGroupName.trim(),
        group_key: key,
        show_on_leaderboard: false,
        key_generated_at: serverTimestamp(),
        created_by: currentUser.uid,
        created_at: serverTimestamp(),
      })

      const memberRef = doc(collection(db, 'group_members'))
      await setDoc(memberRef, {
        group_id: groupRef.id,
        user_id: currentUser.uid,
        role: 'admin',
        joined_at: serverTimestamp(),
      })

      setShowCreateModal(false)
      setNewGroupName('')
      triggerToast(t('groups.createdSuccess'), 'success')
      fetchGroups()

      // Navigate to detail
      navigation.navigate('GroupDetail', {
        groupId: groupRef.id,
        groupName: newGroupName.trim(),
      })
    } catch (err) {
      console.error(err)
      triggerToast(t('groups.createFailed'), 'error')
    } finally {
      setModalLoading(false)
    }
  }

  const handleJoinGroup = async () => {
    if (!currentUser) return
    if (!joinGroupKey.trim()) {
      triggerToast(t('groups.enterKeyError'), 'error')
      return
    }

    const cleanedKey = joinGroupKey.trim().toUpperCase()
    setModalLoading(true)

    try {
      // 1. Query groups matching the key
      const groupsRef = collection(db, 'groups')
      const q = query(groupsRef, where('group_key', '==', cleanedKey))
      const groupSnap = await getDocs(q)

      if (groupSnap.empty) {
        triggerToast(t('groups.groupNotFoundError'), 'error')
        setModalLoading(false)
        return
      }

      const groupDoc = groupSnap.docs[0]
      const groupId = groupDoc.id
      const groupData = groupDoc.data()
      const groupName = groupData.name

      // Check 7-day invite key expiry
      const keyGenTime = groupData.key_generated_at?.toDate
        ? groupData.key_generated_at.toDate()
        : groupData.created_at?.toDate
        ? groupData.created_at.toDate()
        : null

      if (keyGenTime) {
        const diffDays =
          (Date.now() - keyGenTime.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays > 7) {
          triggerToast(
            'This invite link has expired. Please ask the group admin for a fresh link.',
            'error'
          )
          setModalLoading(false)
          return
        }
      }

      // 2. Check if user was previously removed or left (permanent exclusion)
      const exclusionRef = doc(
        db,
        'group_exclusions',
        `${groupId}_${currentUser.uid}`
      )
      const exclusionSnap = await getDoc(exclusionRef)
      if (exclusionSnap.exists()) {
        const reason = exclusionSnap.data()?.reason
        const msg =
          reason === 'removed'
            ? 'You were removed from this group and cannot rejoin.'
            : 'You left this group and cannot rejoin.'
        triggerToast(msg, 'error')
        setModalLoading(false)
        return
      }

      // 3. Check if already a member
      const membersRef = collection(db, 'group_members')
      const memberQ = query(
        membersRef,
        where('group_id', '==', groupId),
        where('user_id', '==', currentUser.uid)
      )
      const memberSnap = await getDocs(memberQ)

      if (!memberSnap.empty) {
        triggerToast(t('groups.alreadyMember'), 'info')
        setShowJoinModal(false)
        setJoinGroupKey('')
        navigation.navigate('GroupDetail', { groupId, groupName })
        setModalLoading(false)
        return
      }

      // 3. Join the group
      const newMemberRef = doc(collection(db, 'group_members'))
      await setDoc(newMemberRef, {
        group_id: groupId,
        user_id: currentUser.uid,
        role: 'member',
        joined_at: serverTimestamp(),
      })

      setShowJoinModal(false)
      setJoinGroupKey('')
      triggerToast(t('groups.joinSuccess'), 'success')
      fetchGroups()

      navigation.navigate('GroupDetail', { groupId, groupName })
    } catch (err) {
      console.error(err)
      triggerToast(t('groups.joinFailed'), 'error')
    } finally {
      setModalLoading(false)
    }
  }

  const filteredGroups = groups.filter(
    g =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.group_key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group card skeleton loader
  const GroupSkeleton = () => (
    <View
      style={[
        styles.skeletonCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardLeft}>
        <View
          style={[
            styles.skeletonAvatar,
            { backgroundColor: colors.surfaceVariant },
          ]}
        />
        <View style={styles.cardInfo}>
          <View
            style={[
              styles.skeletonTextName,
              { backgroundColor: colors.surfaceVariant },
            ]}
          />
          <View
            style={[
              styles.skeletonTextKey,
              { backgroundColor: colors.surfaceVariant },
            ]}
          />
        </View>
      </View>
      <View
        style={[
          styles.skeletonBadge,
          { backgroundColor: colors.surfaceVariant },
        ]}
      />
    </View>
  )

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.groupCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() =>
        navigation.navigate('GroupDetail', {
          groupId: item.id,
          groupName: item.name,
        })
      }
    >
      <View style={styles.cardLeft}>
        <View
          style={[styles.avatar, { backgroundColor: colors.primary + '14' }]}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.groupName, { color: colors.text }]}>
            {item.name}
          </Text>
          <View style={styles.keyContainer}>
            <Text style={[styles.keyLabel, { color: colors.textSecondary }]}>
              {t('groups.keyLabel')}
            </Text>
            <Text style={[styles.keyValue, { color: colors.textSecondary }]}>
              {item.group_key}
            </Text>
            <TouchableOpacity
              onPress={() => handleCopyKey(item)}
              style={styles.copyButton}
            >
              <Ionicons
                name={
                  copiedId === item.id ? 'checkmark-circle' : 'copy-outline'
                }
                size={14}
                color={copiedId === item.id ? colors.accent : colors.muted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View
          style={[styles.badge, { backgroundColor: colors.primary + '14' }]}
        >
          <Ionicons name="people" size={12} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {item.member_count}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </TouchableOpacity>
  )

  // Custom themed variables
  const themedStyles = {
    screen: {
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
    },
    searchContainer: {
      backgroundColor: colors.surfaceVariant,
    },
    searchInput: {
      color: colors.text,
    },
    btnJoin: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    modalOverlay: {
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)',
    },
    modalCard: {
      backgroundColor: colors.surface,
    },
    modalHeader: {
      borderBottomColor: colors.border,
    },
    modalInput: {
      borderColor: colors.border,
      color: colors.text,
      backgroundColor: colors.surfaceVariant,
    },
    btnCancel: {
      backgroundColor: colors.surfaceVariant,
      borderColor: colors.border,
    },
  }

  return (
    <SafeAreaView style={[styles.screen, themedStyles.screen]}>
      <Toast
        message={toastMsg}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Header with Search and Actions */}
      <View style={[styles.header, themedStyles.header]}>
        <View style={[styles.searchContainer, themedStyles.searchContainer]}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, themedStyles.searchInput]}
            placeholder={t('groups.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnJoin, themedStyles.btnJoin]}
            onPress={() => setShowJoinModal(true)}
          >
            <Ionicons name="enter-outline" size={16} color={colors.primary} />
            <Text style={[styles.btnJoinText, { color: colors.primary }]}>
              {t('groups.join')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.btnCreate,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={[styles.btnCreateText, { color: colors.white }]}>
              {t('groups.create')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Wake-up Check-in Banner */}
      {isInWakeUpWindow && wantsToFast && !hasCheckedInToday && (
        <View style={[styles.checkInBanner, { backgroundColor: colors.primary }]}>
          <View style={styles.checkInContent}>
            <Ionicons name="alarm-outline" size={20} color={colors.white} />
            <View style={styles.checkInText}>
              <Text style={styles.checkInTitle}>Wake Up Window Active</Text>
              <Text style={styles.checkInSubtitle}>Check in to prevent buzzing from group members</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.checkInBtn}
            onPress={handleDirectCheckIn}
          >
            <Text style={styles.checkInBtnText}>I'm Awake</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.listContent}>
          <View style={styles.circularLoaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading your groups...
            </Text>
          </View>
          <GroupSkeleton />
          <GroupSkeleton />
          <GroupSkeleton />
          <GroupSkeleton />
          <GroupSkeleton />
          <GroupSkeleton />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={54} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No groups yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Create a new group to invite friends, or join an existing one using a unique key.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={item => item.id}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={54} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No groups found
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Try a different search term
              </Text>
            </View>
          }
        />
      )}

      {/* Create Group Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalOverlay, themedStyles.modalOverlay]}>
          <View style={[styles.modalCard, themedStyles.modalCard]}>
            <View style={[styles.modalHeader, themedStyles.modalHeader]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('groups.create')}
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>
                {t('groups.groupName')}
              </Text>
              <TextInput
                style={[styles.modalInput, themedStyles.modalInput]}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder={t('groups.namePlaceholder')}
                placeholderTextColor={colors.muted}
                maxLength={30}
              />
              <Text style={[styles.modalInfo, { color: colors.textSecondary }]}>
                {t('groups.createInfo')}
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnCancel,
                  themedStyles.btnCancel,
                ]}
                onPress={() => setShowCreateModal(false)}
                disabled={modalLoading}
              >
                <Text
                  style={[styles.modalBtnCancelText, { color: colors.text }]}
                >
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleCreateGroup}
                disabled={modalLoading}
              >
                {modalLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.modalBtnConfirmText,
                      { color: colors.white },
                    ]}
                  >
                    {t('common.create')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Group Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={[styles.modalOverlay, themedStyles.modalOverlay]}>
          <View style={[styles.modalCard, themedStyles.modalCard]}>
            <View style={[styles.modalHeader, themedStyles.modalHeader]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('groups.join')}
              </Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>
                {t('groups.groupKey')}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  themedStyles.modalInput,
                  styles.keyInput,
                ]}
                value={joinGroupKey}
                onChangeText={setJoinGroupKey}
                placeholder={t('groups.keyPlaceholder')}
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                maxLength={10}
              />
              <Text style={[styles.modalInfo, { color: colors.textSecondary }]}>
                {t('groups.joinInfo')}
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnCancel,
                  themedStyles.btnCancel,
                ]}
                onPress={() => setShowJoinModal(false)}
                disabled={modalLoading}
              >
                <Text
                  style={[styles.modalBtnCancelText, { color: colors.text }]}
                >
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleJoinGroup}
                disabled={modalLoading}
              >
                {modalLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.modalBtnConfirmText,
                      { color: colors.white },
                    ]}
                  >
                    {t('groups.joinShort')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Check-in PIN Modal */}
      <Modal
        visible={showPinModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPinModal(false)}
      >
        <View style={[styles.modalOverlay, themedStyles.modalOverlay]}>
          <View style={[styles.modalCard, themedStyles.modalCard]}>
            <View style={[styles.modalHeader, themedStyles.modalHeader]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Enter Your Alarm PIN
              </Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.modalInfo, { color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }]}>
                Enter your personal 4-digit PIN to confirm you are awake.
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', columnGap: 12, marginBottom: 12 }}>
                {pinDigits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={pinRefs[i]}
                    value={digit}
                    onChangeText={(val) => handlePinDigit(i, val)}
                    onKeyPress={(e) => handlePinKeyDown(i, e)}
                    keyboardType="number-pad"
                    maxLength={1}
                    secureTextEntry
                    style={{
                      width: 52, height: 60,
                      textAlign: 'center',
                      fontSize: 26, fontWeight: '900',
                      borderWidth: 2,
                      borderColor: digit ? colors.primary : colors.border,
                      borderRadius: 10,
                      backgroundColor: digit ? colors.primary + '10' : colors.surfaceVariant,
                      color: colors.text,
                    }}
                  />
                ))}
              </View>
              {pinError ? (
                <Text style={[styles.dateErrorText, { textAlign: 'center' }]}>{pinError}</Text>
              ) : null}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, themedStyles.btnCancel]}
                onPress={() => setShowPinModal(false)}
                disabled={loading}
              >
                <Text style={[styles.modalBtnCancelText, { color: colors.text }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, { backgroundColor: colors.primary }]}
                onPress={() => handlePinSubmit()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={[styles.modalBtnConfirmText, { color: colors.white }]}>
                    Confirm — I'm Awake
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    columnGap: 6,
  },
  btnJoin: {
    borderWidth: 1.5,
  },
  btnJoinText: {
    fontWeight: '700',
    fontSize: 13,
  },
  btnCreateText: {
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
  },
  circularLoaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  groupCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  },
  skeletonCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    height: 78,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
  },
  skeletonTextName: {
    width: 120,
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonTextKey: {
    width: 70,
    height: 12,
    borderRadius: 4,
  },
  skeletonBadge: {
    width: 32,
    height: 22,
    borderRadius: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  keyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyLabel: {
    fontSize: 12,
    marginRight: 4,
  },
  keyValue: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Quicksand-SemiBold',
  },
  copyButton: {
    padding: 4,
    marginLeft: 6,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    columnGap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalContent: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  keyInput: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  modalInfo: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 12,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    columnGap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
  },
  modalBtnCancelText: {
    fontWeight: '700',
    fontSize: 14,
  },
  modalBtnConfirmText: {
    fontWeight: '700',
    fontSize: 14,
  },
  checkInBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkInContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkInText: {
    marginLeft: 12,
    flex: 1,
  },
  checkInTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  checkInSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  checkInBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  checkInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateInput: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  dateErrorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
})

export default GroupsScreen
