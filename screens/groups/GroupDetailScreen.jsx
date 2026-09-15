import React, { useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Vibration,
  Share,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native'
import { copyToClipboard } from '../../utils/clipboard'
import { Text } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useNetwork } from '../../context/NetworkContext'
import { useFastingTimes } from '../../hooks/useFastingTimes'
import { useGamification } from '../../hooks/useGamification'
import { db } from '../../config/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import Colors from '../../constants/Colors'
import Ionicons from 'react-native-vector-icons/Ionicons'
import Toast from '../../components/Toast'

export const GroupDetailScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params
  const { currentUser, userProfile } = useAuth()
  const { isConnected: isSocketConnected } = useSocket()
  const { isConnected: isNetworkConnected } = useNetwork()
  const {
    socket,
    isConnected,
    joinGroup,
    leaveGroup,
    emitWakeUp,
    buzzUser,
    on,
    off,
  } = useSocket()
  const { todayData } = useFastingTimes()
  const { recordActivity } = useGamification()

  // Tab state: 'tracker' | 'members'
  const [activeTab, setActiveTab] = useState('tracker')

  // Group metadata
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // Group settings/edit states
  const [isEditingName, setIsEditingName] = useState(false)
  const [newGroupName, setNewGroupName] = useState(groupName)
  const [savingName, setSavingName] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false) // Leaderboard visibility toggle

  // Wake up logs and intentions
  const [wakeUpLogs, setWakeUpLogs] = useState([])
  const [memberIntentions, setMemberIntentions] = useState({})
  const [onlineMembers, setOnlineMembers] = useState([])
  const [hasWokenUp, setHasWokenUp] = useState(false)
  const [wantsToFast, setWantsToFast] = useState(true)
  const [isInWindow, setIsInWindow] = useState(false)

  // PIN verification states for wake-up check-in
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState('')
  const pinRefs = [useRef(), useRef(), useRef(), useRef()]

  // Buzz state
  const [isBuzzing, setIsBuzzing] = useState(false)
  const [buzzData, setBuzzData] = useState(null) // Store buzz data (fromUserName, groupName)
  const [buzzCounts, setBuzzCounts] = useState({}) // Track buzz counts per target per day

  // Member action modal state (for 3-dots / hold-down)
  const [selectedMemberForAction, setSelectedMemberForAction] = useState(null)
  const [showMemberActionModal, setShowMemberActionModal] = useState(false)

  // Toast notifications state
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')

  const triggerToast = (msg, type) => {
    setToastMsg(msg)
    setToastType(type)
    setToastVisible(true)
  }

  const openMemberActionMenu = member => {
    setSelectedMemberForAction(member)
    setShowMemberActionModal(true)
  }

  // 1. Fetch group metadata and members list
  const fetchGroupAndMembers = async () => {
    if (!currentUser || !groupId) return
    try {
      const groupRef = doc(db, 'groups', groupId)
      const groupSnap = await getDoc(groupRef)
      if (groupSnap.exists()) {
        const groupData = { id: groupSnap.id, ...groupSnap.data() }
        setGroup(groupData)
        // Set leaderboard visibility from group data (default to false)
        setShowLeaderboard(groupData.show_on_leaderboard || false)
      }

      const membersRef = collection(db, 'group_members')
      const q = query(membersRef, where('group_id', '==', groupId))
      const querySnapshot = await getDocs(q)

      const membersData = []
      for (const docSnap of querySnapshot.docs) {
        const member = docSnap.data()
        const profileRef = doc(db, 'profiles', member.user_id)
        const profileSnap = await getDoc(profileRef)

        if (profileSnap.exists()) {
          membersData.push({
            id: docSnap.id,
            ...member,
            profiles: {
              id: profileSnap.id,
              ...profileSnap.data(),
            },
          })
        }
      }
      setMembers(membersData)
    } catch (err) {
      console.error('Error fetching group and members:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroupAndMembers()
  }, [groupId, currentUser])

  // Helper to determine member status based on time and check-in
  const getMemberStatus = member => {
    if (!member?.profiles) return 'sleeping'

    const hasCheckedInToday = wakeUpLogs.some(
      log =>
        log.user_id === member.profiles.id &&
        log.date === new Date().toLocaleDateString('en-CA')
    )

    const intendsToFast = memberIntentions[member.profiles.id] !== false

    if (!intendsToFast) {
      return 'not_fasting'
    }

    if (hasCheckedInToday) {
      return 'awake'
    }

    return 'sleeping'
  }

  // Get member wake-up time from profile preferences or default (45m before suhoor)
  const getMemberWakeUpTime = member => {
    const profile = member?.profiles
    const wakeMinutes =
      profile?.preferences?.wakeUpMinutesBeforeSuhoor ||
      profile?.wakeUpMinutesBeforeSuhoor ||
      profile?.customWakeUpMinutes ||
      45

    if (todayData?.time?.sahur) {
      const [suhoorH, suhoorM] = todayData.time.sahur.split(':').map(Number)
      if (!isNaN(suhoorH) && !isNaN(suhoorM)) {
        const suhoorTime = new Date()
        suhoorTime.setHours(suhoorH, suhoorM, 0, 0)
        suhoorTime.setMinutes(suhoorTime.getMinutes() - Number(wakeMinutes))
        return `${String(suhoorTime.getHours()).padStart(2, '0')}:${String(suhoorTime.getMinutes()).padStart(2, '0')}`
      }
    }

    if (profile?.customWakeUpTime) {
      return profile.customWakeUpTime
    }

    return '--:--'
  }

  // Check if wakeup status should be displayed:
  // Shows by 0:00 (midnight) and disappears when it's time for Fajr / 6:00
  const isStatusVisibleNow = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const nowMinutes = currentHour * 60 + currentMinute

    // Determine cutoff time (suhoor time or 6:00 AM)
    let cutoffMinutes = 6 * 60 // fallback to 6:00 AM
    if (todayData?.time?.sahur) {
      const [h, m] = todayData.time.sahur.split(':').map(Number)
      if (!isNaN(h) && !isNaN(m)) {
        cutoffMinutes = h * 60 + m
      }
    }

    // Visible from 0:00 (0 mins) up to cutoff
    return nowMinutes >= 0 && nowMinutes <= cutoffMinutes
  }

  // Check if a specific member is currently in their individual wake-up window
  const isMemberInWakeUpWindow = member => {
    if (!todayData?.time?.sahur) return false
    const now = new Date()
    const wakeUpStr = getMemberWakeUpTime(member)
    if (!wakeUpStr || wakeUpStr === '--:--') return false
    const [wH, wM] = wakeUpStr.split(':').map(Number)
    if (isNaN(wH) || isNaN(wM)) return false

    const wakeTime = new Date()
    wakeTime.setHours(wH, wM, 0, 0)

    const [suhoorH, suhoorM] = todayData.time.sahur.split(':').map(Number)
    const suhoorTime = new Date()
    suhoorTime.setHours(suhoorH, suhoorM, 0, 0)

    return now >= wakeTime && now <= suhoorTime
  }

  // Determine if current user is admin
  const isCurrentUserAdmin =
    members.find(m => m?.profiles?.id === currentUser?.uid)?.role === 'admin'

  // 2. Fetch today's wake-up logs and fasting intentions from Firestore
  const fetchTodayLogsAndIntentions = useCallback(async () => {
    if (!currentUser || !groupId) return
    try {
      const today = new Date().toLocaleDateString('en-CA')

      // Fetch wake up logs
      const logsRef = collection(db, 'wake_up_logs')
      const q = query(logsRef, where('date', '==', today))
      const querySnapshot = await getDocs(q)

      const logsData = []
      querySnapshot.forEach(doc => {
        logsData.push({ id: doc.id, ...doc.data() })
      })

      setWakeUpLogs(logsData)
      setHasWokenUp(logsData.some(log => log.user_id === currentUser.uid))

      // Fetch fasting intentions
      const intentions = {}
      await Promise.all(
        members.map(async member => {
          if (!member?.profiles) return
          try {
            const docRef = doc(
              db,
              'daily_fasting_status',
              `${member.profiles.id}_${today}`
            )
            const docSnap = await getDoc(docRef)
            if (docSnap.exists()) {
              intentions[member.profiles.id] = docSnap.data().wantsToFast
            } else {
              intentions[member.profiles.id] = true // Default
            }
          } catch (e) {
            console.error(e)
          }
        })
      )
      setMemberIntentions(intentions)
    } catch (err) {
      console.error('Error fetching logs and intentions:', err)
    }
  }, [groupId, currentUser, members])

  useEffect(() => {
    if (members.length > 0) {
      fetchTodayLogsAndIntentions()
    }
  }, [members, fetchTodayLogsAndIntentions])

  // 3. Socket.IO connections and listeners
  useEffect(() => {
    if (!groupId) return

    if (isSocketConnected) {
      const userName =
        userProfile?.display_name ||
        currentUser?.displayName ||
        currentUser?.email ||
        'User'
      joinGroup(groupId, userName)
    }

    return () => {
      if (isSocketConnected) {
        leaveGroup(groupId)
      }
    }
  }, [groupId, isSocketConnected, joinGroup, leaveGroup, currentUser, userProfile])

  useEffect(() => {
    if (!isSocketConnected) return

    const handleMemberWokeUp = data => {
      console.log('🌅 Member woke up socket event:', data)

      setWakeUpLogs(prev => {
        const exists = prev.some(
          log =>
            log.user_id === data.userId && log.woke_up_at === data.wakeUpTime
        )
        if (exists) return prev

        const today = new Date().toISOString().split('T')[0]
        return [
          ...prev,
          {
            user_id: data.userId,
            group_id: groupId,
            date: today,
            woke_up_at: data.wakeUpTime,
          },
        ]
      })

      if (data.userId === currentUser?.uid) {
        setHasWokenUp(true)
      } else {
        triggerToast(`${data.userName} has woken up!`, 'info')
      }
    }

    const handleGroupMembersUpdate = data => {
      setOnlineMembers(data.onlineMembers || [])
    }

    const handleGotBuzzed = data => {
      const buzzAllowed = userProfile?.preferences?.buzzNotifications ?? true
      if (!buzzAllowed) return
      console.log('Got buzzed by:', data.fromUserName, 'from group:', data.groupName)
      setBuzzData({
        fromUserName: data.fromUserName,
        groupName: data.groupName,
      })
      setIsBuzzing(true)
    }

    on('member-woke-up', handleMemberWokeUp)
    on('group-members-update', handleGroupMembersUpdate)
    on('get-buzzed', handleGotBuzzed)

    return () => {
      off('member-woke-up', handleMemberWokeUp)
      off('group-members-update', handleGroupMembersUpdate)
      off('get-buzzed', handleGotBuzzed)
    }
  }, [isSocketConnected, groupId, currentUser, on, off])

  // Loop vibration if user is buzzing
  useEffect(() => {
    let interval
    if (isBuzzing) {
      // Vibrate pattern: wait 0ms, vibrate 500ms, wait 500ms
      Vibration.vibrate([0, 500, 500], true)
    } else {
      Vibration.cancel()
    }
    return () => {
      Vibration.cancel()
      clearInterval(interval)
    }
  }, [isBuzzing])

  // 4. Calculate Wake Up Window (45 minutes before Suhoor ends)
  useEffect(() => {
    const checkTime = () => {
      if (!todayData?.time?.sahur) return

      const now = new Date()
      const [suhoorH, suhoorM] = todayData.time.sahur.split(':').map(Number)

      // Wake-up window starts 45 minutes before Suhoor ends
      const suhoorTime = new Date()
      suhoorTime.setHours(suhoorH, suhoorM, 0, 0)

      // Adjust for next day if Suhoor time has passed
      if (suhoorTime < now && now.getHours() > 12) {
        suhoorTime.setDate(suhoorTime.getDate() + 1)
      }

      const wakeUpTime = new Date(suhoorTime.getTime() - 45 * 60000)

      const active = now >= wakeUpTime && now <= suhoorTime
      setIsInWindow(active)
    }

    const interval = setInterval(checkTime, 10000)
    checkTime()
    return () => clearInterval(interval)
  }, [todayData])

  // 5. Actions: Edit name, invite, leave, buzz, remove member, toggle leaderboard
  const handleSaveGroupName = async () => {
    if (!groupId || !newGroupName.trim()) return
    setSavingName(true)
    try {
      const groupRef = doc(db, 'groups', groupId)
      await updateDoc(groupRef, { name: newGroupName.trim() })
      setGroup(prev => ({ ...prev, name: newGroupName.trim() }))
      setIsEditingName(false)
      triggerToast('Group name updated successfully!', 'success')
    } catch (err) {
      console.error(err)
      triggerToast('Failed to update group name.', 'error')
    } finally {
      setSavingName(false)
    }
  }

  const handleToggleLeaderboard = async () => {
    if (!groupId) return
    try {
      const groupRef = doc(db, 'groups', groupId)
      await updateDoc(groupRef, { show_on_leaderboard: !showLeaderboard })
      setShowLeaderboard(!showLeaderboard)
      setGroup(prev => ({ ...prev, show_on_leaderboard: !showLeaderboard }))
      triggerToast(
        `Group ${!showLeaderboard ? 'added to' : 'removed from'} leaderboard.`,
        'success'
      )
    } catch (err) {
      console.error(err)
      triggerToast('Failed to update leaderboard visibility.', 'error')
    }
  }

  const handleShareKey = async () => {
    if (!group) return
    try {
      await Share.share({
        message: `Join my Suhoor group network!\nGroup Name: ${group.name}\nGroup Key: ${group.group_key}\nLink: https://suhoor-group.web.app/groups?groupKey=${group.group_key}`,
      })
    } catch (error) {
      console.error('Error sharing key:', error)
    }
  }

  const handleCopyKey = async () => {
    if (!group) return
    await copyToClipboard(group.group_key)
    triggerToast('Group key copied!', 'success')
  }

  const handleCopyInviteLink = async () => {
    if (!group) return
    const link = `https://suhoorapp.cv/groups?groupKey=${group.group_key}`
    await copyToClipboard(link)
    triggerToast('Group invite link copied!', 'success')
  }

  const handleLeaveGroup = () => {
    if (!currentUser) return
    if (isCurrentUserAdmin) {
      Alert.alert(
        'Cannot Leave',
        'As the group admin, you cannot leave this group.'
      )
      return
    }
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? You will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            try {
              const membersRef = collection(db, 'group_members')
              const q = query(
                membersRef,
                where('group_id', '==', groupId),
                where('user_id', '==', currentUser.uid)
              )
              const snap = await getDocs(q)

              if (!snap.empty) {
                await deleteDoc(doc(db, 'group_members', snap.docs[0].id))
              }

              // Permanently exclude user from rejoining
              await setDoc(
                doc(db, 'group_exclusions', `${groupId}_${currentUser.uid}`),
                {
                  group_id: groupId,
                  user_id: currentUser.uid,
                  reason: 'left',
                  created_at: serverTimestamp(),
                }
              )

              triggerToast('You left this group.', 'success')
              navigation.navigate('GroupsList')
            } catch (err) {
              console.error(err)
              triggerToast('Failed to leave group.', 'error')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleBuzzMember = async member => {
    if (!currentUser || !member?.profiles) return
    const targetMemberIntent = memberIntentions[member.profiles.id] !== false
    if (!targetMemberIntent) {
      triggerToast(
        `${member.profiles.display_name || 'Member'} is not fasting today and cannot be buzzed.`,
        'info'
      )
      return
    }

    // Must be in their own wake up window
    if (!isMemberInWakeUpWindow(member)) {
      triggerToast(
        `${member.profiles.display_name || 'Member'} is not in their wake-up window yet.`,
        'info'
      )
      return
    }

    // Check 5-minute grace period after wake-up time to prevent immediate buzzing
    const wakeUpStr = getMemberWakeUpTime(member)
    if (wakeUpStr && wakeUpStr !== '--:--') {
      const [wH, wM] = wakeUpStr.split(':').map(Number)
      if (!isNaN(wH) && !isNaN(wM)) {
        const wakeTime = new Date()
        wakeTime.setHours(wH, wM, 0, 0)
        const now = new Date()
        const gracePeriodMs = 5 * 60 * 1000 // 5 minutes
        const elapsedSinceWakeUp = now.getTime() - wakeTime.getTime()

        if (elapsedSinceWakeUp < gracePeriodMs) {
          const remainingSecs = Math.ceil((gracePeriodMs - elapsedSinceWakeUp) / 1000)
          const remainingMins = Math.floor(remainingSecs / 60)
          const remainingSecPart = remainingSecs % 60
          const timeText = remainingMins > 0 ? `${remainingMins}m ${remainingSecPart}s` : `${remainingSecs}s`
          triggerToast(
            `${member.profiles.display_name || 'Member'} has a 5-minute wake-up grace period (${timeText} remaining).`,
            'info'
          )
          return
        }
      }
    }

    // Check 3-minute cooldown across the group for this member
    try {
      const buzzDocRef = doc(db, 'group_buzzes', `${groupId}_${member.profiles.id}`)
      const buzzSnap = await getDoc(buzzDocRef)
      const COOLDOWN_MS = 3 * 60 * 1000 // 3 minutes cooldown

      if (buzzSnap.exists()) {
        const data = buzzSnap.data()
        const lastBuzzed = data.timestamp || (data.buzzed_at?.toMillis ? data.buzzed_at.toMillis() : 0)
        const elapsed = Date.now() - lastBuzzed
        if (elapsed < COOLDOWN_MS) {
          const remainingSecs = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
          const remainingMins = Math.floor(remainingSecs / 60)
          const remainingSecPart = remainingSecs % 60
          const timeText = remainingMins > 0 ? `${remainingMins}m ${remainingSecPart}s` : `${remainingSecs}s`
          triggerToast(
            `${member.profiles.display_name || 'Member'} is already being buzzed. Cooldown active (${timeText} remaining).`,
            'info'
          )
          return
        }
      }

      const fromName =
        userProfile?.display_name ||
        currentUser.displayName ||
        currentUser.email ||
        'Group Member'

      // Record buzz in Firestore so all group members respect the 3-minute cooldown between buzzes
      await setDoc(buzzDocRef, {
        group_id: groupId,
        target_user_id: member.profiles.id,
        buzzed_by_user_id: currentUser.uid,
        buzzed_by_name: fromName,
        group_name: group?.name || '',
        timestamp: Date.now(),
        buzzed_at: serverTimestamp(),
      })

      // Pass group name to the buzzed user via socket
      buzzUser(member.profiles.id, groupId, fromName, group?.name)

      // Award points for successful buzz
      await recordActivity('buzz_member')

      triggerToast(
        `Buzzed ${member.profiles.display_name || member.profiles.email}!`,
        'success'
      )
    } catch (err) {
      console.error('Error buzzing member:', err)
      triggerToast('Failed to buzz member. Try again.', 'error')
    }
  }

  const handleRemoveMember = member => {
    if (!member?.profiles) return
    const targetUserId = member.profiles?.id || member.user_id
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.profiles.display_name || member.profiles.email} from the group? They will be permanently barred from re-entering.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            try {
              await deleteDoc(doc(db, 'group_members', member.id))

              if (targetUserId) {
                await setDoc(
                  doc(db, 'group_exclusions', `${groupId}_${targetUserId}`),
                  {
                    group_id: groupId,
                    user_id: targetUserId,
                    reason: 'removed',
                    by_user_id: currentUser.uid,
                    created_at: serverTimestamp(),
                  }
                )
              }

              triggerToast(
                'Member removed and barred from rejoining.',
                'success'
              )
              fetchGroupAndMembers()
            } catch (err) {
              console.error(err)
              triggerToast('Failed to remove member.', 'error')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const openPinModal = () => {
    setPinDigits(['', '', '', ''])
    setPinError('')
    setShowPinModal(true)
    setTimeout(() => pinRefs[0]?.current?.focus(), 200)
  }

  const handlePinDigitDetail = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const next = [...pinDigits]
    next[index] = digit
    setPinDigits(next)
    setPinError('')
    if (digit && index < 3) pinRefs[index + 1]?.current?.focus()
    if (digit && index === 3) {
      const entered = [...next.slice(0, 3), digit].join('')
      validateAndWakeUp(entered)
    }
  }

  const handlePinKeyDownDetail = (index, e) => {
    if (e.nativeEvent?.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1]?.current?.focus()
    }
  }

  // Wake-up validation using PIN
  const validateAndWakeUp = async (overridePin) => {
    if (!currentUser) return
    const entered = overridePin ?? pinDigits.join('')
    if (entered.length < 4) {
      setPinError('Enter your 4-digit alarm PIN.')
      return
    }
    let savedPin = ''
    try {
      savedPin = (await AsyncStorage.getItem('suhoor_alarm_pin')) || ''
    } catch { }
    if (savedPin && entered !== savedPin) {
      setPinError('Incorrect PIN. Try again.')
      setPinDigits(['', '', '', ''])
      setTimeout(() => pinRefs[0]?.current?.focus(), 100)
      return
    }

    setShowPinModal(false)
    setIsBuzzing(false)
    setLoading(true)

    try {
      const todayStr = new Date().toLocaleDateString('en-CA')
      const wakeUpTime = new Date().toISOString()

      await addDoc(collection(db, 'wake_up_logs'), {
        user_id: currentUser.uid,
        date: todayStr,
        woke_up_at: wakeUpTime,
      })

      // Award points for successful wake-up
      await recordActivity('wake_up', { minutesBeforeFajr: todayData?.minutesBeforeFajr })

      const name =
        userProfile?.display_name ||
        currentUser.displayName ||
        currentUser.email ||
        'User'
      emitWakeUp(groupId, name, wakeUpTime)
      setHasWokenUp(true)
      triggerToast("Intention recorded! You're awake.", 'success')
      fetchTodayLogsAndIntentions()
    } catch (err) {
      console.error(err)
      triggerToast('Failed to log wake up. Try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getWakeUpStatus = userId => {
    return wakeUpLogs.some(log => log.user_id === userId)
  }

  const isOnline = userId => {
    return onlineMembers.includes(userId)
  }

  // Render member rows
  const renderMemberItem = ({ item }) => {
    if (!item?.profiles) return null

    const memberStatus = getMemberStatus(item)
    const wakeUpTime = getMemberWakeUpTime(item)
    const wakeUpLog = wakeUpLogs.find(
      log => log.user_id === item.profiles.id
    )
    const intendsToFast = memberIntentions[item.profiles.id] !== false
    const showStatus = isStatusVisibleNow()
    const isSelf = item.profiles.id === currentUser?.uid

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => openMemberActionMenu(item)}
        delayLongPress={350}
        style={[
          styles.memberRow,
          memberStatus === 'awake' && styles.memberRowAwake,
          memberStatus === 'not_fasting' && styles.memberRowNotFasting,
        ]}
      >
        <View style={styles.memberLeft}>
          <View style={styles.memberAvatarContainer}>
            <View
              style={[
                styles.memberAvatar,
                item.role === 'admin' && styles.adminAvatar,
              ]}
            >
              <Text style={styles.memberAvatarText}>
                {item.profiles.display_name?.charAt(0).toUpperCase() ||
                  item.profiles.email?.charAt(0).toUpperCase()}
              </Text>
            </View>
            {isOnline(item.profiles.id) && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.profiles.display_name ||
                  item.profiles.email.split('@')[0]}
              </Text>
              {item.role === 'admin' ? (
                <View style={styles.adminRoleBadge}>
                  <Text style={styles.adminRoleBadgeText}>Admin</Text>
                </View>
              ) : null}
              {isSelf ? (
                <View style={styles.selfBadge}>
                  <Text style={styles.selfBadgeText}>You</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.memberDetailsRow}>
              <View style={styles.timeTag}>
                <Ionicons name="alarm-outline" size={12} color={Colors.primary} />
                <Text style={styles.timeTagText}>{wakeUpTime}</Text>
              </View>
              {showStatus ? (
                memberStatus === 'awake' ? (
                  <View style={styles.awakeBadge}>
                    <Ionicons name="checkmark-circle" size={11} color={Colors.accent} />
                    <Text style={styles.awakeBadgeText}>
                      Awake{wakeUpLog ? ` (${new Date(wakeUpLog.woke_up_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                    </Text>
                  </View>
                ) : memberStatus === 'sleeping' && intendsToFast ? (
                  <View style={styles.sleepingBadge}>
                    <Ionicons name="moon" size={10} color={Colors.secondary} />
                    <Text style={styles.sleepingBadgeText}>Asleep</Text>
                  </View>
                ) : memberStatus === 'not_fasting' || !intendsToFast ? (
                  <View style={styles.notFastingBadge}>
                    <Text style={styles.notFastingBadgeText}>Not Fasting</Text>
                  </View>
                ) : null
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.memberActions}>
          {memberStatus === 'sleeping' &&
            intendsToFast &&
            !isSelf &&
            isMemberInWakeUpWindow(item) && (
              <TouchableOpacity
                style={styles.buzzIconBtn}
                onPress={() => handleBuzzMember(item)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="notifications"
                  size={15}
                  color={Colors.secondary}
                />
                <Text style={styles.buzzBtnText}>Buzz</Text>
              </TouchableOpacity>
            )}

          {/* 3 vertical dots action button in front of member */}
          <TouchableOpacity
            style={styles.memberDotsBtn}
            onPress={() => openMemberActionMenu(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.dark} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading && !group) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Toast
        message={toastMsg}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Group Info Card */}
      <View style={styles.groupHeaderCard}>
        <View style={styles.groupTitleRow}>
          {isEditingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              <TouchableOpacity
                style={styles.editSaveBtn}
                onPress={handleSaveGroupName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.editSaveText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setIsEditingName(false)}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.titleDisplayRow}>
              <Text style={styles.groupTitleText}>{group?.name}</Text>
              {isCurrentUserAdmin && (
                <TouchableOpacity
                  onPress={() => setIsEditingName(true)}
                  style={styles.editIconBtn}
                >
                  <Ionicons name="pencil" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {isNetworkConnected && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </View>

        <View style={styles.groupDetailsRow}>
          <View style={styles.keyBadge}>
            <Ionicons
              name="key"
              size={12}
              color={Colors.primary}
              style={styles.keyIcon}
            />
            <Text style={styles.keyText}>{group?.group_key}</Text>
            <TouchableOpacity onPress={handleCopyKey} style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={12} color={Colors.gray} />
            </TouchableOpacity>
          </View>
          <Text style={styles.membersCountText}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn]}
            onPress={handleShareKey}
          >
            <Ionicons
              name="share-social-outline"
              size={16}
              color={Colors.primary}
            />
            <Text style={styles.shareBtnText}>Invite Link</Text>
          </TouchableOpacity>
          {isCurrentUserAdmin && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.leaderboardBtn]}
              onPress={handleToggleLeaderboard}
            >
              <Ionicons
                name={showLeaderboard ? "trophy" : "trophy-outline"}
                size={16}
                color={showLeaderboard ? Colors.accent : Colors.gray}
              />
              <Text style={[styles.leaderboardBtnText, { color: showLeaderboard ? Colors.accent : Colors.gray }]}>
                {showLeaderboard ? 'On Leaderboard' : 'Off Leaderboard'}
              </Text>
            </TouchableOpacity>
          )}
          {!isCurrentUserAdmin && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.leaveBtn]}
              onPress={handleLeaveGroup}
            >
              <Ionicons name="log-out-outline" size={16} color={Colors.red} />
              <Text style={styles.leaveBtnText}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented Tab Bar */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'tracker' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveTab('tracker')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="alarm-outline"
            size={16}
            color={activeTab === 'tracker' ? Colors.white : Colors.primary}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'tracker' && styles.segmentTextActive,
            ]}
          >
            Wake Tracker
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'members' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveTab('members')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'members' ? Colors.white : Colors.primary}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'members' && styles.segmentTextActive,
            ]}
          >
            Group Info
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'tracker' ? (
        /* Tracker Card */
        <View style={styles.trackerCard}>
          <View style={styles.trackerHeader}>
            <View style={styles.trackerTitleLeft}>
              <Text style={styles.trackerTitle}>Wake Up Tracker</Text>
            </View>

            {hasWokenUp ? (
              <View style={styles.awakeSuccess}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={Colors.accent}
                />
                <Text style={styles.awakeSuccessText}>Awake</Text>
              </View>
            ) : wantsToFast ? (
              <View style={styles.sleepingBadge}>
                <Text style={styles.sleepingBadgeText}>Asleep</Text>
              </View>
            ) : null}
          </View>

          <FlatList
            data={members}
            keyExtractor={item => item.id}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.membersList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        /* Group Info Card */
        <View style={styles.trackerCard}>
          <View style={styles.trackerHeader}>
            <Text style={styles.trackerTitle}>Group Members</Text>
          </View>

          <FlatList
            data={members}
            keyExtractor={item => item.id}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.membersList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Buzz Alarm Overlay Modal - Similar to main AlarmOverlay */}
      <Modal visible={!isBuzzing} animationType="fade" transparent={false}>
        <View style={styles.buzzOverlay}>
          {/* Logo at top */}
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12, marginBottom: 20 }}>
            <Image
              source={require('../../assets/icon-nobg.png')}
              style={{ width: 48, height: 48 }}
              resizeMode="contain"
            />
            <Text variant="display" style={{
              fontFamily: 'Quicksand-Regular',
              fontWeight: '700',
              color: '#FBBF24',
              fontSize: 28
            }}>
              Suhoor
            </Text>
          </View>

          {/* Animated notification icon */}
          <View style={{ alignItems: 'center', marginVertical: 30 }}>
            <Ionicons
              name="notifications"
              size={100}
              color="#FBBF24"
            />
          </View>

          {/* Titles */}
          <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
            <Text style={{
              fontSize: 32,
              fontWeight: '800',
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: 12
            }}>
              WAKE UP!
            </Text>
            <Text style={{
              fontSize: 18,
              color: 'rgba(255,255,255,0.9)',
              textAlign: 'center',
              lineHeight: 24
            }}>
              {/* {buzzData?.fromUserName || 'Your group member'} from {buzzData?.groupName || 'your group'} is waking you for Suhoor! */}
              {buzzData?.fromUserName || 'Abdulqoyum'} from {buzzData?.groupName || 'Awolowo Hall'} is waking you for Suhoor!
            </Text>
            <Text style={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: 14, 
              textAlign: 'center', 
              marginTop: 16,
              paddingHorizontal: 24 
            }}>
              Press the button below to dismiss. Check in on the Groups tab to stop being buzzed.
            </Text>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.buzzDismissBtn}
            onPress={() => setIsBuzzing(false)}
          >
            <Text style={styles.buzzDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* PIN Verification Modal */}
      <Modal visible={showPinModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Alarm PIN</Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)}>
                <Ionicons name="close" size={24} color={Colors.dark} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.verificationPrompt, { textAlign: 'center', marginBottom: 20 }]}>
                Enter your personal 4-digit PIN to confirm you are awake.
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', columnGap: 12, marginBottom: 12 }}>
                {pinDigits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={pinRefs[i]}
                    value={digit}
                    onChangeText={(val) => handlePinDigitDetail(i, val)}
                    onKeyPress={(e) => handlePinKeyDownDetail(i, e)}
                    keyboardType="number-pad"
                    maxLength={1}
                    secureTextEntry
                    style={{
                      width: 52, height: 60,
                      textAlign: 'center',
                      fontSize: 26, fontWeight: '900',
                      borderWidth: 2,
                      borderColor: digit ? Colors.primary : '#E5E7EB',
                      borderRadius: 10,
                      backgroundColor: digit ? 'rgba(61,31,148,0.06)' : '#F9FAFB',
                      color: Colors.dark,
                    }}
                  />
                ))}
              </View>
              {pinError ? (
                <Text style={[styles.dateErrorText, { textAlign: 'center' }]}>{pinError}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => validateAndWakeUp()}
            >
              <Text style={styles.modalConfirmText}>Confirm — I'm Awake</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Member Action Modal (Hold-down / 3-dots sheet) */}
      <Modal
        visible={showMemberActionModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMemberActionModal(false)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberActionModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.actionModalSheet}
            onPress={e => e.stopPropagation?.()}
          >
            <View style={styles.actionModalHandle} />
            <View style={styles.actionModalHeader}>
              <View style={styles.actionModalAvatar}>
                <Text style={styles.actionModalAvatarText}>
                  {selectedMemberForAction?.profiles?.display_name?.charAt(0).toUpperCase() ||
                    selectedMemberForAction?.profiles?.email?.charAt(0).toUpperCase() ||
                    'U'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionModalName} numberOfLines={1}>
                  {selectedMemberForAction?.profiles?.display_name ||
                    selectedMemberForAction?.profiles?.email?.split('@')[0] ||
                    'Member'}
                </Text>
                <Text style={styles.actionModalRole}>
                  {selectedMemberForAction?.role === 'admin' ? 'Group Admin' : 'Member'} • Wake-up at {getMemberWakeUpTime(selectedMemberForAction)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMemberActionModal(false)}
                style={styles.actionModalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionModalOptions}>
              {/* Buzz Option if eligible */}
              {getMemberStatus(selectedMemberForAction) === 'sleeping' &&
                memberIntentions[selectedMemberForAction?.profiles?.id] !== false &&
                selectedMemberForAction?.profiles?.id !== currentUser?.uid &&
                isMemberInWakeUpWindow(selectedMemberForAction) && (
                  <TouchableOpacity
                    style={styles.actionModalItem}
                    onPress={() => {
                      const m = selectedMemberForAction
                      setShowMemberActionModal(false)
                      handleBuzzMember(m)
                    }}
                  >
                    <View style={[styles.actionModalItemIcon, { backgroundColor: 'rgba(249, 168, 38, 0.14)' }]}>
                      <Ionicons name="notifications" size={18} color={Colors.secondary} />
                    </View>
                    <Text style={[styles.actionModalItemText, { color: Colors.secondary }]}>
                      Buzz Member (Wake Up)
                    </Text>
                  </TouchableOpacity>
                )}

              {/* Copy Name */}
              <TouchableOpacity
                style={styles.actionModalItem}
                onPress={async () => {
                  const name = selectedMemberForAction?.profiles?.display_name || selectedMemberForAction?.profiles?.email || ''
                  if (name) {
                    await copyToClipboard(name)
                    triggerToast('Copied name to clipboard', 'info')
                  }
                  setShowMemberActionModal(false)
                }}
              >
                <View style={[styles.actionModalItemIcon, { backgroundColor: 'rgba(21, 12, 51, 0.06)' }]}>
                  <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.actionModalItemText}>Copy Member Name</Text>
              </TouchableOpacity>

              {/* Remove Member option for Admins */}
              {isCurrentUserAdmin && selectedMemberForAction?.profiles?.id !== currentUser?.uid && (
                <TouchableOpacity
                  style={[styles.actionModalItem, styles.actionModalItemDanger]}
                  onPress={() => {
                    const memberToRemove = selectedMemberForAction
                    setShowMemberActionModal(false)
                    handleRemoveMember(memberToRemove)
                  }}
                >
                  <View style={[styles.actionModalItemIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Ionicons name="trash-outline" size={18} color={Colors.red} />
                  </View>
                  <Text style={[styles.actionModalItemText, { color: Colors.red, fontWeight: '700' }]}>
                    Remove Member from Group
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupHeaderCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(61, 31, 148, 0.05)',
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark,
  },
  editIconBtn: {
    marginLeft: 8,
    padding: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    columnGap: 8,
  },
  editInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 15,
  },
  editSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: 'center',
  },
  editSaveText: {
    color: Colors.white,
    fontWeight: '700',
  },
  editCancelBtn: {
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: 'center',
  },
  editCancelText: {
    color: Colors.dark,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    columnGap: 4,
  },
  liveDot: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
  },
  liveText: {
    fontSize: 10,
    color: Colors.green,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  groupDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    marginBottom: 16,
  },
  keyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  keyIcon: {
    marginRight: 4,
  },
  keyText: {
    fontSize: 11,
    fontFamily: 'Quicksand-SemiBold',
    fontWeight: '600',
    color: Colors.dark,
  },
  copyBtn: {
    padding: 2,
    marginLeft: 6,
  },
  membersCountText: {
    fontSize: 12,
    color: Colors.gray,
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 8,
    columnGap: 6,
    borderWidth: 1,
  },
  shareBtn: {
    backgroundColor: Colors.white,
    borderColor: Colors.muted,
  },
  shareBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  leaderboardBtn: {
    backgroundColor: Colors.white,
    borderColor: Colors.muted,
  },
  leaderboardBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  leaveBtnText: {
    color: Colors.red,
    fontSize: 12,
    fontWeight: '700',
  },
  // Tracker Card
  trackerCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.muted,
    paddingBottom: 14,
    marginBottom: 10,
  },
  trackerTitleLeft: {
    flexDirection: 'column',
    rowGap: 4,
  },
  trackerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    columnGap: 4,
    alignSelf: 'flex-start',
  },
  locationBadgeText: {
    fontSize: 9,
    color: Colors.red,
    fontWeight: '700',
  },
  wakeUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    columnGap: 6,
  },
  wakeUpBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  awakeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  awakeSuccessText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  membersList: {
    paddingBottom: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  memberRowAwake: {
    backgroundColor: 'rgba(0, 194, 168, 0.03)',
  },
  memberRowNotFasting: {
    opacity: 0.5,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  memberAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(61, 31, 148, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminAvatar: {
    backgroundColor: '#FEF3C7',
  },
  memberAvatarText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: Colors.green,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 4,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark,
  },
  awakeBadge: {
    backgroundColor: 'rgba(0, 194, 168, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  awakeBadgeText: {
    fontSize: 9,
    color: Colors.accent,
    fontWeight: '700',
  },
  notFastingBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  notFastingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.red,
  },
  sleepingBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  sleepingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.blue,
  },
  memberDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    marginTop: 4,
  },
  memberDetailText: {
    fontSize: 11,
    color: Colors.gray,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberEmail: {
    fontSize: 11,
    color: Colors.gray,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  buzzIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: 'rgba(249, 168, 38, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    columnGap: 4,
  },
  buzzBtnText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: '700',
  },
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    columnGap: 4,
  },
  findText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  // Buzz Alarm Overlay
  buzzOverlay: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingTop: 80,
  },
  buzzDismissBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 16,
    marginTop: 40,
    marginBottom: 60,
    width: '100%',
    maxWidth: 280,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  buzzDismissText: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  // Date Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.muted,
    paddingBottom: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark,
  },
  modalContent: {
    marginBottom: 20,
  },
  verificationPrompt: {
    fontSize: 13,
    color: Colors.gray,
    lineHeight: 18,
    marginBottom: 16,
  },
  dateInput: {
    borderWidth: 2,
    borderColor: Colors.muted,
    borderRadius: 10,
    height: 48,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark,
    letterSpacing: 2,
  },
  dateErrorText: {
    color: Colors.red,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  modalConfirmBtn: {
    backgroundColor: Colors.primary,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(61, 31, 148, 0.08)',
    borderRadius: 14,
    padding: 4,
    columnGap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    columnGap: 6,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  segmentTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  adminRoleBadge: {
    backgroundColor: 'rgba(249, 168, 38, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  adminRoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
    textTransform: 'uppercase',
  },
  selfBadge: {
    backgroundColor: 'rgba(61, 31, 148, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  selfBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    backgroundColor: 'rgba(21, 12, 51, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  memberDotsBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionModalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  actionModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  actionModalAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionModalAvatarText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  actionModalName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: 2,
  },
  actionModalRole: {
    fontSize: 12,
    color: Colors.gray,
  },
  actionModalCloseBtn: {
    padding: 6,
  },
  actionModalOptions: {
    rowGap: 10,
  },
  actionModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  actionModalItemDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  actionModalItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionModalItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark,
  },
})

export default GroupDetailScreen
