import React, { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
} from "react-native";
import { copyToClipboard } from "../../utils/clipboard";
import { Text } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useSocket } from "../../context/SocketContext";
import { useNetwork } from "../../context/NetworkContext";
import { useFastingTimes } from "../../hooks/useFastingTimes";
import { useGamification } from "../../hooks/useGamification";
import { db } from "../../config/firebase";
import { COLLECTIONS, wakeUpLogId } from "../../config/firestoreSchema";
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
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "../../components/Toast";
import GamificationCelebration from "../../components/GamificationCelebration";

// Module-level cache (survives component unmounts)
const fetchedGroupsCache = new Set();

export const GroupDetailScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const { currentUser, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { isConnected: isSocketConnected } = useSocket();
  const { isConnected: isNetworkConnected, isOffline } = useNetwork();
  const {
    socket,
    isConnected,
    joinGroup,
    leaveGroup,
    emitWakeUp,
    buzzUser,
    on,
    off,
  } = useSocket();
  const { todayData } = useFastingTimes();
  const { recordActivity, celebration, dismissCelebration } = useGamification();

  // Group metadata
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Wake up logs and intentions
  const [wakeUpLogs, setWakeUpLogs] = useState([]);
  const [memberIntentions, setMemberIntentions] = useState({});
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [hasWokenUp, setHasWokenUp] = useState(false);
  const [wantsToFast, setWantsToFast] = useState(true);

  // Buzz state & real-time cooldown tracking
  const [recentBuzzTimestamps, setRecentBuzzTimestamps] = useState({});

  // Member action modal state (for 3-dots / hold-down)
  const [selectedMemberForAction, setSelectedMemberForAction] = useState(null);
  const [showMemberActionModal, setShowMemberActionModal] = useState(false);

  // Toast notifications state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("info");
  const [toastDuration, setToastDuration] = useState(3000);

  // Bulk buzz selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState([]);
  const [isBulkBuzzing, setIsBulkBuzzing] = useState(false);
  const bulkRunIdRef = useRef(0);

  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const openMemberActionMenu = (member) => {
    setSelectedMemberForAction(member);
    setShowMemberActionModal(true);
  };

  // 1. Fetch group metadata and members list
  const fetchGroupAndMembers = async () => {
    if (!currentUser || !groupId) return;

    // Use module-level cache
    if (fetchedGroupsCache.has(groupId)) {
      setLoading(false);
      return;
    }

    try {
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const groupData = { id: groupSnap.id, ...groupSnap.data() };
        setGroup(groupData);
        // Update the navigation header with the group picture
        navigation.setParams({ groupPicture: groupData.group_picture_url });
      }

      setMembersLoading(true);

      const membersRef = collection(db, COLLECTIONS.groupMembers);
      const q = query(membersRef, where("group_id", "==", groupId));
      const querySnapshot = await getDocs(q);

      const seen = new Map();
      for (const docSnap of querySnapshot.docs) {
        const member = docSnap.data();
        if (!member.user_id) continue;
        const existing = seen.get(member.user_id);
        if (existing && existing.role === "admin") continue;

        const profileRef = doc(db, COLLECTIONS.profiles, member.user_id);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          seen.set(member.user_id, {
            id: docSnap.id,
            ...member,
            profiles: {
              id: profileSnap.id,
              ...profileSnap.data(),
            },
          });
        }
      }
      setMembers([...seen.values()]);
      setMembersLoading(false);
      
      // Add to module-level cache
      fetchedGroupsCache.add(groupId);
    } catch (err) {
      console.error("Error fetching group and members:", err);
      setMembersLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Realtime listener for group members updates
  useEffect(() => {
    if (!currentUser || !groupId) return;

    const membersRef = collection(db, COLLECTIONS.groupMembers);
    const q = query(membersRef, where("group_id", "==", groupId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (fetchedGroupsCache.has(groupId)) { // Changed to module-level cache
        const seen = new Map();
        for (const docSnap of snapshot.docs) {
          const member = docSnap.data();
          if (!member.user_id) continue;
          const existing = seen.get(member.user_id);
          if (existing && existing.role === "admin") continue;

          const profileRef = doc(db, COLLECTIONS.profiles, member.user_id);
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            seen.set(member.user_id, {
              id: docSnap.id,
              ...member,
              profiles: {
                id: profileSnap.id,
                ...profileSnap.data(),
              },
            });
          }
        }
        setMembers([...seen.values()]);
      }
    }, (err) => {
      console.warn("Realtime members listener error:", err);
    });

    return () => unsubscribe();
  }, [groupId, currentUser]);

  useEffect(() => {
    fetchGroupAndMembers();
  }, [groupId, currentUser]);

  const isOnline = (userId) => Array.isArray(onlineMembers) && onlineMembers.includes(userId);

  const getMemberStatus = (member) => {
    if (!member?.profiles) return "sleeping";

    const hasCheckedInToday = wakeUpLogs.some(
      (log) =>
        log.user_id === member.profiles.id &&
        log.date === new Date().toLocaleDateString("en-CA")
    );

    const intendsToFast = memberIntentions[member.profiles.id] !== false;

    if (!intendsToFast) return "not_fasting";
    if (hasCheckedInToday) return "awake";

    const isCurrentUser = member.profiles.id === currentUser?.uid;
    if (isCurrentUser && isNetworkConnected) return "awake";
    if (isOnline(member.profiles.id)) return "awake";

    return "sleeping";
  };

  const getMemberWakeUpTime = (member) => {
    const profile = member?.profiles;
    const wakeMinutes =
      profile?.preferences?.wakeUpMinutesBeforeSuhoor ||
      profile?.wakeUpMinutesBeforeSuhoor ||
      profile?.customWakeUpMinutes ||
      45;

    if (todayData?.time?.sahur) {
      const [suhoorH, suhoorM] = todayData.time.sahur.split(":").map(Number);
      if (!isNaN(suhoorH) && !isNaN(suhoorM)) {
        const suhoorTime = new Date();
        suhoorTime.setHours(suhoorH, suhoorM, 0, 0);
        suhoorTime.setMinutes(suhoorTime.getMinutes() - Number(wakeMinutes));
        return `${String(suhoorTime.getHours()).padStart(2, "0")}:${String(
          suhoorTime.getMinutes()
        ).padStart(2, "0")}`;
      }
    }

    if (profile?.customWakeUpTime) return profile.customWakeUpTime;

    return "--:--";
  };

  const isStatusVisibleNow = () => {
    if (!todayData?.time?.sahur) return false;

    const now = new Date();
    const [suhoorH, suhoorM] = todayData.time.sahur.split(":").map(Number);
    if (isNaN(suhoorH) || isNaN(suhoorM)) return false;

    const suhoorTime = new Date();
    suhoorTime.setHours(suhoorH, suhoorM, 0, 0);

    if (now > suhoorTime && now.getHours() > 12) return false;

    const wakeMinutes = userProfile?.preferences?.wakeUpMinutesBeforeSuhoor || 45;
    const wakeUpStartTime = new Date(suhoorTime.getTime() - wakeMinutes * 60000);

    return now >= wakeUpStartTime && now <= suhoorTime;
  };

  const isMemberInWakeUpWindow = (member) => {
    if (!todayData?.time?.sahur) return false;
    const now = new Date();
    const wakeUpStr = getMemberWakeUpTime(member);
    if (!wakeUpStr || wakeUpStr === "--:--") return false;
    const [wH, wM] = wakeUpStr.split(":").map(Number);
    if (isNaN(wH) || isNaN(wM)) return false;

    const wakeTime = new Date();
    wakeTime.setHours(wH, wM, 0, 0);

    const [suhoorH, suhoorM] = todayData.time.sahur.split(":").map(Number);
    const suhoorTime = new Date();
    suhoorTime.setHours(suhoorH, suhoorM, 0, 0);

    return now >= wakeTime && now <= suhoorTime;
  };

  const isCurrentUserAdmin =
    members.find((m) => m?.profiles?.id === currentUser?.uid)?.role === "admin";

  const fetchTodayLogsAndIntentions = useCallback(async () => {
    if (!currentUser || !groupId) return;
    try {
      const today = new Date().toLocaleDateString("en-CA");

      const logsRef = collection(db, COLLECTIONS.wakeUpLogs);
      const q = query(logsRef, where("date", "==", today));
      const querySnapshot = await getDocs(q);

      const logsData = [];
      querySnapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() });
      });

      setWakeUpLogs(logsData);
      setHasWokenUp(logsData.some((log) => log.user_id === currentUser.uid));

      const intentions = {};
      await Promise.all(
        members.map(async (member) => {
          if (!member?.profiles) return;
          try {
            const docRef = doc(
              db,
              COLLECTIONS.dailyFastingStatus,
              `${member.profiles.id}_${today}`
            );
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              intentions[member.profiles.id] = docSnap.data().wantsToFast;
            } else {
              intentions[member.profiles.id] = true;
            }
          } catch (e) {
            console.error(e);
          }
        })
      );
      setMemberIntentions(intentions);

      if (currentUser && currentUser.uid in intentions) {
        setWantsToFast(intentions[currentUser.uid] !== false);
      }
    } catch (err) {
      console.error("Error fetching logs and intentions:", err);
    }
  }, [groupId, currentUser, members]);

  const todayKey = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    if (members.length > 0) {
      fetchTodayLogsAndIntentions();
    }
  }, [members, fetchTodayLogsAndIntentions, todayKey]);

  useEffect(() => {
    if (!groupId) return;

    if (isSocketConnected) {
      const userName =
        userProfile?.display_name ||
        currentUser?.displayName ||
        currentUser?.email ||
        "User";
      joinGroup(groupId, userName);
    }

    return () => {
      if (isSocketConnected) {
        leaveGroup(groupId);
      }
    };
  }, [groupId, isSocketConnected, joinGroup, leaveGroup, currentUser, userProfile]);

  useEffect(() => {
    if (!isSocketConnected) return;

    const handleMemberWokeUp = (data) => {
      setWakeUpLogs((prev) => {
        const exists = prev.some(
          (log) =>
            log.user_id === data.userId && log.woke_up_at === data.wakeUpTime
        );
        if (exists) return prev;

        const today = new Date().toLocaleDateString("en-CA");
        return [
          ...prev,
          {
            user_id: data.userId,
            group_id: groupId,
            date: today,
            woke_up_at: data.wakeUpTime,
          },
        ];
      });

      if (data.userId === currentUser?.uid) {
        setHasWokenUp(true);
      } else {
        triggerToast(
          t('groups.memberWokeUpToast', { name: data.userName }),
          "info"
        );
      }
    };

    const handleGroupMembersUpdate = (data) => {
      setOnlineMembers(data.onlineMembers || []);
    };

    on("member-woke-up", handleMemberWokeUp);
    on("group-members-update", handleGroupMembersUpdate);

    return () => {
      off("member-woke-up", handleMemberWokeUp);
      off("group-members-update", handleGroupMembersUpdate);
    };
  }, [isSocketConnected, groupId, currentUser, on, off]);

  useEffect(() => {
    if (!groupId) return;
    const buzzesRef = collection(db, COLLECTIONS.groupBuzzes);
    const q = query(buzzesRef, where("group_id", "==", groupId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const timestamps = {};
        snapshot.forEach((d) => {
          const data = d.data();
          const timestamp = data.timestamp || (data.buzzed_at?.toMillis ? data.buzzed_at.toMillis() : 0);
          if (data.target_user_id) {
            timestamps[data.target_user_id] = timestamp;
          }
        });
        setRecentBuzzTimestamps(timestamps);
      },
      (err) => {
        console.error("Error listening to group buzzes:", err);
      }
    );
    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Trigger a re-render to update countdown ticks
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatRemainingTime = (ms) => {
    const remainingSecs = Math.ceil(ms / 1000);
    const remainingMins = Math.floor(remainingSecs / 60);
    const remainingSecPart = remainingSecs % 60;
    return remainingMins > 0
      ? `${remainingMins}m ${remainingSecPart}s`
      : `${remainingSecs}s`;
  };

  const formatCountdown = (ms) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getBuzzRemainingMs = (userId) => {
    const lastBuzzed = recentBuzzTimestamps[userId];
    if (!lastBuzzed) return 0;
    const elapsed = Date.now() - lastBuzzed;
    const COOLDOWN_MS = 3 * 60 * 1000;
    const remaining = COOLDOWN_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  };

  const checkBuzzEligibility = async (member) => {
    if (!currentUser || !member?.profiles) return { ok: false, reason: "invalid" };
    if (member.profiles.id === currentUser.uid) return { ok: false, reason: "self" };
    if (memberIntentions[member.profiles.id] === false) {
      return { ok: false, reason: "not_fasting" };
    }
    if (!isMemberInWakeUpWindow(member)) {
      return { ok: false, reason: "not_in_window" };
    }

    if (group?.only_admins_buzz && !isCurrentUserAdmin) {
      return { ok: false, reason: "admins_only" };
    }

    const wakeUpStr = getMemberWakeUpTime(member);
    if (wakeUpStr && wakeUpStr !== "--:--") {
      const [wH, wM] = wakeUpStr.split(":").map(Number);
      if (!isNaN(wH) && !isNaN(wM)) {
        const wakeTime = new Date();
        wakeTime.setHours(wH, wM, 0, 0);
        const gracePeriodMs = 5 * 60 * 1000;
        const elapsedSinceWakeUp = Date.now() - wakeTime.getTime();

        if (elapsedSinceWakeUp < gracePeriodMs) {
          return {
            ok: false,
            reason: "grace",
            timeText: formatRemainingTime(gracePeriodMs - elapsedSinceWakeUp),
            wakeTimeText: wakeUpStr,
          };
        }
      }
    }

    const buzzDocRef = doc(
      db,
      COLLECTIONS.groupBuzzes,
      `${groupId}_${member.profiles.id}`
    );
    const buzzSnap = await getDoc(buzzDocRef);
    const COOLDOWN_MS = 3 * 60 * 1000;

    if (buzzSnap.exists()) {
      const data = buzzSnap.data();
      const lastBuzzed =
        data.timestamp ||
        (data.buzzed_at?.toMillis ? data.buzzed_at.toMillis() : 0);
      const elapsed = Date.now() - lastBuzzed;
      if (elapsed < COOLDOWN_MS) {
        return {
          ok: false,
          reason: "cooldown",
          timeText: formatRemainingTime(COOLDOWN_MS - elapsed),
        };
      }
    }

    return { ok: true, buzzDocRef };
  };

  const getBuzzRejectionMessage = (member, check) => {
    const name = member?.profiles?.display_name || t('groups.member');
    switch (check.reason) {
      case "admins_only":
        return t('groups.onlyAdminsCanBuzz', 'Only group admins can send wake-up buzzes');
      case "self":
        return t('groups.cannotBuzzSelf');
      case "not_fasting":
        return t('groups.buzzTargetNotFasting', { name });
      case "not_in_window":
        return t('groups.buzzTargetNotInWindow', { name });
      case "grace":
        return t('groups.buzzGracePeriod', { name, time: check.timeText });
      case "cooldown":
        return t('groups.buzzCooldownActive', { name, time: check.timeText });
      default:
        return t('groups.buzzMemberError');
    }
  };

  const performBuzz = async (member, buzzDocRef) => {
    const fromName =
      userProfile?.display_name ||
      currentUser.displayName ||
      currentUser.email ||
      t('groups.member');

    await setDoc(buzzDocRef, {
      group_id: groupId,
      target_user_id: member.profiles.id,
      buzzed_by_user_id: currentUser.uid,
      buzzed_by_name: fromName,
      group_name: group?.name || "",
      timestamp: Date.now(),
      buzzed_at: serverTimestamp(),
    });

    buzzUser(member.profiles.id, groupId, fromName, group?.name);

    await recordActivity("buzz_member");
  };

  const handleBuzzMember = async (member) => {
    if (!currentUser || !member?.profiles) return;
    try {
      const check = await checkBuzzEligibility(member);
      if (!check.ok) {
        if (check.reason === "grace") {
          Alert.alert(
            t('groups.gracePeriodTitle'),
            t('groups.gracePeriodBody', {
              name: member.profiles.display_name || member.profiles.email,
              wakeTime: check.wakeTimeText,
              remaining: check.timeText,
            })
          );
        } else {
          triggerToast(getBuzzRejectionMessage(member, check), "info");
        }
        return;
      }

      await performBuzz(member, check.buzzDocRef);

      triggerToast(
        t('groups.buzzSentTo', {
          name: member.profiles.display_name || member.profiles.email,
        }),
        "success"
      );
    } catch (err) {
      console.error("Error buzzing member:", err);
      triggerToast(t('groups.buzzMemberError'), "error");
    }
  };

  const handleBulkBuzz = async () => {
    if (!currentUser || isBulkBuzzing) return;
    const targets = members.filter(
      (m) => m?.profiles && selectedBulkIds.includes(m.profiles.id)
    );
    if (targets.length === 0) return;

    const runId = ++bulkRunIdRef.current;
    setIsBulkBuzzing(true);

    const logEntries = [];
    let buzzedCount = 0;

    for (const member of targets) {
      if (bulkRunIdRef.current !== runId) break;
      try {
        const check = await checkBuzzEligibility(member);
        if (!check.ok) {
          logEntries.push({
            msg: getBuzzRejectionMessage(member, check),
            type: "info",
          });
          continue;
        }
        await performBuzz(member, check.buzzDocRef);
        buzzedCount += 1;
        logEntries.push({
          msg: t('groups.buzzSentTo', {
            name: member.profiles.display_name || member.profiles.email,
          }),
          type: "success",
        });
      } catch (err) {
        console.error("Error buzzing member in bulk:", err);
        logEntries.push({ msg: t('groups.buzzMemberError'), type: "error" });
      }
    }

    for (const entry of logEntries) {
      if (bulkRunIdRef.current !== runId) break;
      setToastDuration(2200);
      triggerToast(entry.msg, entry.type);
      await new Promise((resolve) => setTimeout(resolve, 2600));
    }
    if (bulkRunIdRef.current !== runId) return;

    setToastDuration(3000);
    triggerToast(t('groups.bulkBuzzDone', { number: buzzedCount }), "success");

    setIsBulkBuzzing(false);
    setBulkMode(false);
    setSelectedBulkIds([]);
  };

  const isMemberBuzzable = (member) => {
    if (group?.only_admins_buzz && !isCurrentUserAdmin) return false;
    if (!isStatusVisibleNow()) return false;
    if (!currentUser || !member?.profiles) return false;
    if (member.profiles.id === currentUser.uid) return false;
    if (memberIntentions[member.profiles.id] === false) return false;
    if (getMemberStatus(member) !== "sleeping") return false;
    return isMemberInWakeUpWindow(member);
  };

  const selectableMembers = members.filter((m) => isMemberBuzzable(m));

  const enterBulkMode = () => {
    setBulkMode(true);
    setSelectedBulkIds(selectableMembers.map((m) => m.profiles.id));
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedBulkIds([]);
  };

  const toggleBulkSelection = (member) => {
    if (!member?.profiles || !isMemberBuzzable(member)) return;
    setSelectedBulkIds((prev) =>
      prev.includes(member.profiles.id)
        ? prev.filter((id) => id !== member.profiles.id)
        : [...prev, member.profiles.id]
    );
  };

  const allSelected =
    selectableMembers.length > 0 &&
    selectableMembers.every((m) => selectedBulkIds.includes(m.profiles.id));

  const toggleSelectAll = () => {
    setSelectedBulkIds(
      allSelected ? [] : selectableMembers.map((m) => m.profiles.id)
    );
  };

  const handleRemoveMember = (member) => {
    if (!member?.profiles) return;
    const targetUserId = member.profiles?.id || member.user_id;
    Alert.alert(
      t('groups.removeMemberTitle'),
      t('groups.removeMemberConfirm', {
        name: member.profiles.display_name || member.profiles.email,
      }),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('groups.remove'),
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await deleteDoc(doc(db, COLLECTIONS.groupMembers, member.id));

              if (targetUserId) {
                await setDoc(
                  doc(db, COLLECTIONS.groupExclusions, `${groupId}_${targetUserId}`),
                  {
                    group_id: groupId,
                    user_id: targetUserId,
                    reason: "removed",
                    by_user_id: currentUser.uid,
                    created_at: serverTimestamp(),
                  }
                );
              }

              // Clear cache so it refetches on next open
              fetchedGroupsCache.delete(groupId);

              triggerToast(t('groups.memberRemoved'), "success");
              fetchGroupAndMembers();
            } catch (err) {
              console.error(err);
              triggerToast(t('groups.removeMemberError'), "error");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // SORT: Pin the current user to the top
  const sortedMembers = [...members].sort((a, b) => {
    const aIsSelf = a.profiles?.id === currentUser?.uid;
    const bIsSelf = b.profiles?.id === currentUser?.uid;
    if (aIsSelf) return -1;
    if (bIsSelf) return 1;
    return 0;
  });

  const renderMemberItem = ({ item }) => {
    if (!item?.profiles) return null;

    const memberStatus = getMemberStatus(item);
    const wakeUpTime = getMemberWakeUpTime(item);
    const wakeUpLog = wakeUpLogs.find(
      (log) => log.user_id === item.profiles.id
    );
    const intendsToFast = memberIntentions[item.profiles.id] !== false;
    const showStatus = isStatusVisibleNow();
    const isSelf = item.profiles.id === currentUser?.uid;

    const isSelected = selectedBulkIds.includes(item.profiles.id);

    // Determine the status badge to show next to the name
    const renderStatusBadge = () => {
      if (!showStatus) return null;

      if (memberStatus === "awake") {
        return (
          <View style={[styles.inlineBadge, { backgroundColor: isDark ? 'rgba(0, 194, 168, 0.15)' : 'rgba(0, 194, 168, 0.1)' }]}>
            <Text style={[styles.inlineBadgeText, { color: colors.success }]}>
              {t('groups.awake', 'Awake')} {wakeUpLog ? `(${new Date(wakeUpLog.woke_up_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : ""}
            </Text>
          </View>
        );
      }

      if (memberStatus === "sleeping" && intendsToFast) {
        return (
          <View style={[styles.inlineBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
            <Text style={[styles.inlineBadgeText, { color: isDark ? '#60A5FA' : '#3B82F6' }]}>
              {t('groups.sleeping', 'Asleep')}
            </Text>
          </View>
        );
      }

      if (memberStatus === "not_fasting" || !intendsToFast) {
        return (
          <View style={[styles.inlineBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' }]}>
            <Text style={[styles.inlineBadgeText, { color: colors.error }]}>
              {t('groups.notFasting', 'Not Fasting')}
            </Text>
          </View>
        );
      }

      return null;
    };

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={bulkMode ? () => toggleBulkSelection(item) : undefined}
        onLongPress={bulkMode ? undefined : () => openMemberActionMenu(item)}
        delayLongPress={350}
        disabled={bulkMode && isSelf}
        style={[
          styles.memberRow,
          memberStatus === "awake" && styles.memberRowAwake,
          memberStatus === "not_fasting" && styles.memberRowNotFasting,
        ]}
      >
        <View style={styles.memberLeft}>
          {bulkMode && !isSelf && (
            <View
              style={[
                styles.bulkCheckbox,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary : "transparent",
                },
              ]}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={14} color={colors.onPrimaryFill} />
              )}
            </View>
          )}
          <View style={styles.memberAvatarContainer}>
            <View
              style={[
                styles.memberAvatar,
                { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(61, 31, 148, 0.1)', overflow: 'hidden' },
              ]}
            >
              {(item.profiles?.avatar_url || item.profiles?.photoURL) ? (
                <Image
                  source={{ uri: item.profiles.avatar_url || item.profiles.photoURL }}
                  style={styles.memberAvatarImage}
                />
              ) : (
                <Ionicons name="person" size={20} color={isDark ? colors.secondary : colors.primary} />
              )}
            </View>
            {isOnline(item.profiles.id) && (
              <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.surface }]} />
            )}
          </View>
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={[styles.memberName, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                {item.profiles.display_name || item.profiles.email.split("@")[0]}
              </Text>
              {renderStatusBadge()}
            </View>
            <View style={styles.memberDetailsRow}>
              <View style={[styles.timeTag, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(21, 12, 51, 0.05)' }]}>
                <Text style={[styles.timeTagText, { color: isDark ? colors.secondary : colors.primary }]}>{wakeUpTime}</Text>
                <Ionicons
                  name="alarm-outline"
                  size={12}
                  color={isDark ? colors.secondary : colors.primary}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.memberActions}>
          {!bulkMode &&
            isMemberBuzzable(item) && (
              getBuzzRemainingMs(item.profiles.id) > 0 ? (
                <View
                  style={[
                    styles.buzzCooldownBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.buzzCooldownText, { color: colors.textSecondary }]}>
                    {formatCountdown(getBuzzRemainingMs(item.profiles.id))}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.buzzYellowBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => handleBuzzMember(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="notifications"
                    size={15}
                    color="#1a1a1a"
                  />
                  <Text style={[styles.buzzYellowBtnText, { color: "#1a1a1a" }]}>{t('groups.buzz')}</Text>
                </TouchableOpacity>
              )
            )}

          {!bulkMode && (
            <TouchableOpacity
              style={styles.memberDotsBtn}
              onPress={() => openMemberActionMenu(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderBulkBar = () => {
    if (members.length === 0) return null;
    if (!isStatusVisibleNow() || selectableMembers.length === 0) return null;

    if (!bulkMode) {
      return (
        <View style={styles.bulkBar}>
          <TouchableOpacity
            style={[styles.bulkStartBtn, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(249, 168, 38, 0.12)' }]}
            onPress={enterBulkMode}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications" size={15} color={colors.secondary} />
            <Text style={[styles.bulkStartText, { color: colors.secondary }]}>
              {t('groups.bulkBuzz', 'Buzz All')} ({selectableMembers.length})
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.bulkBar}>
        <View style={styles.bulkBarTop}>
          <TouchableOpacity
            style={styles.bulkSelectAllBtn}
            onPress={toggleSelectAll}
            disabled={isBulkBuzzing}
            activeOpacity={0.7}
          >
            <Ionicons
              name={allSelected ? "checkbox" : "square-outline"}
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.bulkSelectAllText, { color: colors.primary }]}>
              {t('groups.selectAll')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={exitBulkMode}
            disabled={isBulkBuzzing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.bulkCancelText, { color: colors.textSecondary }]}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.bulkBuzzBtn,
            {
              backgroundColor:
                selectedBulkIds.length > 0
                  ? colors.secondary
                  : colors.surfaceVariant,
            },
          ]}
          onPress={handleBulkBuzz}
          disabled={selectedBulkIds.length === 0 || isBulkBuzzing}
          activeOpacity={0.8}
        >
          {isBulkBuzzing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons
                name="notifications"
                size={16}
                color={selectedBulkIds.length > 0 ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.bulkBuzzBtnText,
                  {
                    color:
                      selectedBulkIds.length > 0
                        ? colors.primary
                        : colors.textSecondary,
                  },
                ]}
              >
                {t('groups.buzzSelected', { number: selectedBulkIds.length })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !group) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <GamificationCelebration
        celebration={celebration}
        onDismiss={dismissCelebration}
      />
      <Toast
        message={toastMsg}
        type={toastType}
        visible={toastVisible}
        duration={toastDuration}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Wake Up Tracker Card */}
      <View style={[styles.trackerCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.trackerHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.trackerTitleLeft}>
            <Text style={[styles.trackerTitle, { color: colors.text }]}>{t('groups.wakeUpTracker')}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {isStatusVisibleNow() ? (
              hasWokenUp ? (
                <View style={styles.awakeSuccess}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.secondary}
                  />
                  <Text style={[styles.awakeSuccessText, { color: colors.secondary }]}>Checked in</Text>
                </View>
              ) : wantsToFast ? (
                <View style={[styles.sleepingBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                  <Text style={[styles.sleepingBadgeText, { color: isDark ? '#60A5FA' : '#3B82F6' }]}>You haven't checked in</Text>
                </View>
              ) : null
            ) : null}
          </View>
        </View>

        {renderBulkBar()}

        {isOffline && (() => {
          const now = new Date();
          const currentHour = now.getHours();
          const fajrTime = todayData?.time?.sahur ? new Date(`2000-01-01T${todayData.time.sahur}:00`) : new Date();
          fajrTime.setHours(4, 30, 0, 0);

          if (currentHour >= 20 || currentHour < fajrTime.getHours()) {
            return (
              <View style={[styles.offlineWarning, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)' }]}>
                <Ionicons name="wifi-off" size={20} color={isDark ? '#F87171' : '#DC2626'} style={styles.warningIcon} />
                <View style={styles.warningTextContainer}>
                  <Text style={[styles.warningTitle, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                    {t('groups.offlineWarningTitle')}
                  </Text>
                  <Text style={[styles.warningMessage, { color: isDark ? '#FECACA' : '#991B1B' }]}>
                    {t('groups.offlineWarningMessage')}
                  </Text>
                </View>
              </View>
            );
          }
          return null;
        })()}

        {membersLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>
              {t('groups.fetchingMembers', 'Fetching members...')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedMembers}
            keyExtractor={(item) => item.id}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.membersList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Member Action Modal (Hold-down / 3-dots sheet) */}
      <Modal
        visible={showMemberActionModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMemberActionModal(false)}
      >
        <TouchableOpacity
          style={[styles.actionModalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
          activeOpacity={1}
          onPress={() => setShowMemberActionModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.actionModalSheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={[styles.actionModalHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.actionModalHeader, { borderBottomColor: colors.border }]}>
              <View style={[styles.actionModalAvatar, { backgroundColor: colors.primary, overflow: 'hidden' }]}>
                {(selectedMemberForAction?.profiles?.avatar_url || selectedMemberForAction?.profiles?.photoURL) ? (
                  <Image
                    source={{ uri: selectedMemberForAction.profiles.avatar_url || selectedMemberForAction.profiles.photoURL }}
                    style={styles.actionModalAvatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={24} color={colors.onPrimaryFill} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionModalName, { color: colors.text }]} numberOfLines={1}>
                  {selectedMemberForAction?.profiles?.display_name ||
                    selectedMemberForAction?.profiles?.email?.split("@")[0] ||
                    t('groups.member')}
                </Text>
                <Text style={[styles.actionModalRole, { color: colors.textSecondary }]}>
                  {selectedMemberForAction?.role === "admin"
                    ? t('groups.groupAdmin')
                    : t('groups.member')}{" "}
                  • {t('groups.wakeUpAt', { time: getMemberWakeUpTime(selectedMemberForAction) })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMemberActionModal(false)}
                style={styles.actionModalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionModalOptions}>
              {getMemberStatus(selectedMemberForAction) === "sleeping" &&
                memberIntentions[selectedMemberForAction?.profiles?.id] !== false &&
                selectedMemberForAction?.profiles?.id !== currentUser?.uid &&
                isMemberInWakeUpWindow(selectedMemberForAction) && (
                  <TouchableOpacity
                    style={[styles.actionModalItem, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => {
                      const m = selectedMemberForAction;
                      setShowMemberActionModal(false);
                      handleBuzzMember(m);
                    }}
                  >
                    <View
                      style={[
                        styles.actionModalItemIcon,
                        { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.14)' : 'rgba(249, 168, 38, 0.14)' },
                      ]}
                    >
                      <Ionicons name="notifications" size={18} color={colors.secondary} />
                    </View>
                    <Text style={[styles.actionModalItemText, { color: colors.secondary }]}>
                      {t('groups.buzzMemberWakeUp')}
                    </Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                style={[styles.actionModalItem, { backgroundColor: colors.surfaceVariant }]}
                onPress={async () => {
                  const name = selectedMemberForAction?.profiles?.display_name || selectedMemberForAction?.profiles?.email || "";
                  if (name) {
                    await copyToClipboard(name);
                    triggerToast(t('groups.nameCopied'), "info");
                  }
                  setShowMemberActionModal(false);
                }}
              >
                <View
                  style={[
                    styles.actionModalItemIcon,
                    { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.06)' : 'rgba(21, 12, 51, 0.06)' },
                  ]}
                >
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.actionModalItemText, { color: colors.text }]}>{t('groups.copyMemberName')}</Text>
              </TouchableOpacity>

              {isCurrentUserAdmin && selectedMemberForAction?.profiles?.id !== currentUser?.uid && (
                <TouchableOpacity
                  style={[styles.actionModalItem, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' }]}
                  onPress={() => {
                    const memberToRemove = selectedMemberForAction;
                    setShowMemberActionModal(false);
                    handleRemoveMember(memberToRemove);
                  }}
                >
                  <View
                    style={[
                      styles.actionModalItemIcon,
                      { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </View>
                  <Text style={[styles.actionModalItemText, { color: colors.error, fontWeight: "700" }]}>
                    {t('groups.removeMember', 'Remove Member from Group')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  trackerCard: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  trackerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 10,
  },
  trackerTitleLeft: {
    flexDirection: "column",
    rowGap: 4,
  },
  trackerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  awakeSuccess: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
  },
  awakeSuccessText: {
    fontSize: 13,
    fontWeight: "700",
  },
  membersList: {
    paddingBottom: 24,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  memberRowAwake: {
  },
  memberRowNotFasting: {
    opacity: 0.5,
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  memberAvatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  memberAvatarText: {
    fontSize: 15,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    top: 0,
    right: 0,
    height: 10,
    width: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 6,
    rowGap: 4,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
  },
  memberDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginTop: 4,
  },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  buzzYellowBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 4,
  },
  buzzYellowBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  buzzCooldownBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 4,
    borderWidth: 1,
  },
  buzzCooldownText: {
    fontSize: 11,
    fontWeight: "700",
  },
  memberDotsBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  actionModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  actionModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  actionModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  actionModalAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  actionModalAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  actionModalAvatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  actionModalName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  actionModalRole: {
    fontSize: 12,
  },
  actionModalCloseBtn: {
    padding: 6,
  },
  actionModalOptions: {
    rowGap: 10,
  },
  actionModalItem: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionModalItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionModalItemText: {
    fontSize: 14,
    fontWeight: "600",
  },
  bulkBar: {
    marginBottom: 10,
    rowGap: 10,
  },
  bulkStartBtn: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  bulkStartText: {
    fontSize: 12,
    fontWeight: "700",
  },
  bulkBarTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulkSelectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  bulkSelectAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  bulkCancelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  bulkBuzzBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    columnGap: 8,
  },
  bulkBuzzBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  bulkCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  warningIcon: {
    marginRight: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
warningMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  inlineBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginLeft: 6,
  },
  inlineBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});

export default GroupDetailScreen;