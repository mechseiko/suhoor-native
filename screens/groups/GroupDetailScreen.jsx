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
import { COLLECTIONS } from "../../config/firestoreSchema";
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
} from "firebase/firestore";
import Colors from "../../constants/Colors";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "../../components/Toast";
import GamificationCelebration from "../../components/GamificationCelebration";

export const GroupDetailScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const { currentUser, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { isConnected: isSocketConnected } = useSocket();
  const { isConnected: isNetworkConnected } = useNetwork();
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

  // Tab state: 'tracker' | 'members'
  const [activeTab, setActiveTab] = useState("tracker");

  // Group metadata
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Group settings/edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState(groupName);
  const [savingName, setSavingName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false); // Leaderboard visibility toggle

  // Wake up logs and intentions
  const [wakeUpLogs, setWakeUpLogs] = useState([]);
  const [memberIntentions, setMemberIntentions] = useState({});
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [hasWokenUp, setHasWokenUp] = useState(false);
  const [wantsToFast, setWantsToFast] = useState(true);
  const [isInWindow, setIsInWindow] = useState(false);

  // PIN verification states for wake-up check-in
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];

  // Buzz state
  const [isBuzzing, setIsBuzzing] = useState(false);
  const [buzzData, setBuzzData] = useState(null); // Store buzz data (fromUserName, groupName)
  const [buzzCounts, setBuzzCounts] = useState({}); // Track buzz counts per target per day

  // Member action modal state (for 3-dots / hold-down)
  const [selectedMemberForAction, setSelectedMemberForAction] = useState(null);
  const [showMemberActionModal, setShowMemberActionModal] = useState(false);

  // Toast notifications state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("info");
  const [toastDuration, setToastDuration] = useState(3000);

  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // Bulk buzz selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState([]);
  const [isBulkBuzzing, setIsBulkBuzzing] = useState(false);
  const bulkRunIdRef = useRef(0);

  const openMemberActionMenu = (member) => {
    setSelectedMemberForAction(member);
    setShowMemberActionModal(true);
  };

  // 1. Fetch group metadata and members list
  const fetchGroupAndMembers = async () => {
    if (!currentUser || !groupId) return;
    try {
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const groupData = { id: groupSnap.id, ...groupSnap.data() };
        setGroup(groupData);
        // Set leaderboard visibility from group data (default to false)
        setShowLeaderboard(groupData.show_on_leaderboard || false);
      }

      // Set members loading state
      setMembersLoading(true);

      const membersRef = collection(db, COLLECTIONS.groupMembers);
      const q = query(membersRef, where("group_id", "==", groupId));
      const querySnapshot = await getDocs(q);

      // Collapse duplicate membership rows (legacy data): one entry per user,
      // keeping the admin row when both admin and member rows exist.
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
    } catch (err) {
      console.error("Error fetching group and members:", err);
      setMembersLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupAndMembers();
  }, [groupId, currentUser]);

  // Helper to determine member status based on time and check-in
  const getMemberStatus = (member) => {
    if (!member?.profiles) return "sleeping";

    const hasCheckedInToday = wakeUpLogs.some(
      (log) =>
        log.user_id === member.profiles.id &&
        log.date === new Date().toLocaleDateString("en-CA")
    );

    const intendsToFast = memberIntentions[member.profiles.id] !== false;

    if (!intendsToFast) {
      return "not_fasting";
    }

    if (hasCheckedInToday) {
      return "awake";
    }

    // UI-level status: the current user is active on this screen and connected,
    // or member is actively online in the app. They cannot be asleep.
    const isCurrentUser = member.profiles.id === currentUser?.uid;
    if (isCurrentUser && isNetworkConnected) {
      return "awake";
    }

    if (isOnline(member.profiles.id)) {
      return "awake";
    }

    return "sleeping";
  };

  // Get member wake-up time from profile preferences or default (45m before suhoor)
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

    if (profile?.customWakeUpTime) {
      return profile.customWakeUpTime;
    }

    return "--:--";
  };

  // Check if wakeup status should be displayed:
  // Shows by 0:00 (midnight) and disappears when it's time for Fajr / 6:00
  const isStatusVisibleNow = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const nowMinutes = currentHour * 60 + currentMinute;

    // Determine cutoff time (suhoor time or 6:00 AM)
    let cutoffMinutes = 6 * 60; // fallback to 6:00 AM
    if (todayData?.time?.sahur) {
      const [h, m] = todayData.time.sahur.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        cutoffMinutes = h * 60 + m;
      }
    }

    // Visible from 0:00 (0 mins) up to cutoff
    return nowMinutes >= 0 && nowMinutes <= cutoffMinutes;
  };

  // Check if a specific member is currently in their individual wake-up window
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

  // Determine if current user is admin
  const isCurrentUserAdmin =
    members.find((m) => m?.profiles?.id === currentUser?.uid)?.role === "admin";

  // 2. Fetch today's wake-up logs and fasting intentions from Firestore
  const fetchTodayLogsAndIntentions = useCallback(async () => {
    if (!currentUser || !groupId) return;
    try {
      const today = new Date().toLocaleDateString("en-CA");

      // Fetch wake up logs
      const logsRef = collection(db, COLLECTIONS.wakeUpLogs);
      const q = query(logsRef, where("date", "==", today));
      const querySnapshot = await getDocs(q);

      const logsData = [];
      querySnapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() });
      });

      setWakeUpLogs(logsData);
      setHasWokenUp(logsData.some((log) => log.user_id === currentUser.uid));

      // Fetch fasting intentions
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
              intentions[member.profiles.id] = true; // Default
            }
          } catch (e) {
            console.error(e);
          }
        })
      );
      setMemberIntentions(intentions);
    } catch (err) {
      console.error("Error fetching logs and intentions:", err);
    }
  }, [groupId, currentUser, members]);

  useEffect(() => {
    if (members.length > 0) {
      fetchTodayLogsAndIntentions();
    }
  }, [members, fetchTodayLogsAndIntentions]);

  // 3. Socket.IO connections and listeners
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
  }, [
    groupId,
    isSocketConnected,
    joinGroup,
    leaveGroup,
    currentUser,
    userProfile,
  ]);

  useEffect(() => {
    if (!isSocketConnected) return;

    const handleMemberWokeUp = (data) => {
      console.log("🌅 Member woke up socket event:", data);

      setWakeUpLogs((prev) => {
        const exists = prev.some(
          (log) =>
            log.user_id === data.userId && log.woke_up_at === data.wakeUpTime
        );
        if (exists) return prev;

        const today = new Date().toISOString().split("T")[0];
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

    const handleGotBuzzed = (data) => {
      const buzzAllowed = userProfile?.preferences?.buzzNotifications ?? true;
      if (!buzzAllowed) return;
      console.log(
        "Got buzzed by:",
        data.fromUserName,
        "from group:",
        data.groupName
      );
      setBuzzData({
        fromUserName: data.fromUserName,
        groupName: data.groupName,
      });
      setIsBuzzing(true);
    };

    on("member-woke-up", handleMemberWokeUp);
    on("group-members-update", handleGroupMembersUpdate);
    on("get-buzzed", handleGotBuzzed);

    return () => {
      off("member-woke-up", handleMemberWokeUp);
      off("group-members-update", handleGroupMembersUpdate);
      off("get-buzzed", handleGotBuzzed);
    };
  }, [isSocketConnected, groupId, currentUser, on, off]);

  // Loop vibration if user is buzzing
  useEffect(() => {
    let interval;
    if (isBuzzing) {
      // Vibrate pattern: wait 0ms, vibrate 500ms, wait 500ms
      Vibration.vibrate([0, 500, 500], true);
    } else {
      Vibration.cancel();
    }
    return () => {
      Vibration.cancel();
      clearInterval(interval);
    };
  }, [isBuzzing]);

  // 4. Calculate Wake Up Window (45 minutes before Suhoor ends)
  useEffect(() => {
    const checkTime = () => {
      if (!todayData?.time?.sahur) return;

      const now = new Date();
      const [suhoorH, suhoorM] = todayData.time.sahur.split(":").map(Number);

      // Wake-up window starts 45 minutes before Suhoor ends
      const suhoorTime = new Date();
      suhoorTime.setHours(suhoorH, suhoorM, 0, 0);

      // Adjust for next day if Suhoor time has passed
      if (suhoorTime < now && now.getHours() > 12) {
        suhoorTime.setDate(suhoorTime.getDate() + 1);
      }

      const wakeUpTime = new Date(suhoorTime.getTime() - 45 * 60000);

      const active = now >= wakeUpTime && now <= suhoorTime;
      setIsInWindow(active);
    };

    const interval = setInterval(checkTime, 10000);
    checkTime();
    return () => clearInterval(interval);
  }, [todayData]);

  // 5. Actions: Edit name, invite, leave, buzz, remove member, toggle leaderboard
  const handleSaveGroupName = async () => {
    if (!groupId || !newGroupName.trim()) return;
    setSavingName(true);
    try {
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      await updateDoc(groupRef, { name: newGroupName.trim() });
      setGroup((prev) => ({ ...prev, name: newGroupName.trim() }));
      setIsEditingName(false);
      triggerToast(t('groups.groupNameUpdated'), "success");
    } catch (err) {
      console.error(err);
      triggerToast(t('groups.groupNameUpdateError'), "error");
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleLeaderboard = async () => {
    if (!groupId) return;
    try {
      const groupRef = doc(db, COLLECTIONS.groups, groupId);
      await updateDoc(groupRef, { show_on_leaderboard: !showLeaderboard });
      setShowLeaderboard(!showLeaderboard);
      setGroup((prev) => ({ ...prev, show_on_leaderboard: !showLeaderboard }));
      triggerToast(
        `Group ${!showLeaderboard ? "added to" : "removed from"} leaderboard.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      triggerToast(t('groups.leaderboardUpdateError'), "error");
    }
  };

  const handleShareKey = async () => {
    if (!group) return;
    try {
      await Share.share({
        message: `Join my Suhoor group network!\nGroup Name: ${group.name}\nGroup Key: ${group.group_key}\nLink: https://suhoor-group.web.app/groups?groupKey=${group.group_key}`,
      });
    } catch (error) {
      console.error("Error sharing key:", error);
    }
  };

  const handleCopyKey = async () => {
    if (!group) return;
    await copyToClipboard(group.group_key);
    triggerToast(t('groups.groupKeyCopied'), "success");
  };

  const handleCopyInviteLink = async () => {
    if (!group) return;
    const link = `https://suhoorapp.cv/groups?groupKey=${group.group_key}`;
    await copyToClipboard(link);
    triggerToast(t('groups.inviteLinkCopied'), "success");
  };

  const handleOpenSettings = () => {
    navigation.navigate('GroupSettings', {
      groupId,
      groupName: group?.name || groupName,
      groupKey: group?.group_key,
      isAdmin: isCurrentUserAdmin,
      admins: members.filter((m) => m?.role === "admin"),
    });
  };

  const handleLeaveGroup = () => {
    if (!currentUser) return;
    if (isCurrentUserAdmin) {
      Alert.alert(
        t('common.cannotLeave'),
        t('groups.cannotLeaveAsAdmin')
      );
      return;
    }
    Alert.alert(
      t('groups.leave'),
      t('groups.leaveGroupConfirm'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('groups.leave'),
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const membersRef = collection(db, COLLECTIONS.groupMembers);
              const q = query(
                membersRef,
                where("group_id", "==", groupId),
                where("user_id", "==", currentUser.uid)
              );
              const snap = await getDocs(q);

              if (!snap.empty) {
                await deleteDoc(doc(db, COLLECTIONS.groupMembers, snap.docs[0].id));
              }

              // Permanently exclude user from rejoining
              await setDoc(
                doc(db, COLLECTIONS.groupExclusions, `${groupId}_${currentUser.uid}`),
                {
                  group_id: groupId,
                  user_id: currentUser.uid,
                  reason: "left",
                  created_at: serverTimestamp(),
                }
              );

              triggerToast(t('groups.leftGroup'), "success");
              navigation.navigate("GroupsList");
            } catch (err) {
              console.error(err);
              triggerToast(t('groups.leaveGroupError'), "error");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatRemainingTime = (ms) => {
    const remainingSecs = Math.ceil(ms / 1000);
    const remainingMins = Math.floor(remainingSecs / 60);
    const remainingSecPart = remainingSecs % 60;
    return remainingMins > 0
      ? `${remainingMins}m ${remainingSecPart}s`
      : `${remainingSecs}s`;
  };

  // Shared eligibility checks: self, fasting intention, wake window,
  // 5-minute grace after wake time, and the 3-minute group cooldown.
  const checkBuzzEligibility = async (member) => {
    if (!currentUser || !member?.profiles) return { ok: false, reason: "invalid" };
    if (member.profiles.id === currentUser.uid) return { ok: false, reason: "self" };
    if (memberIntentions[member.profiles.id] === false) {
      return { ok: false, reason: "not_fasting" };
    }
    if (!isMemberInWakeUpWindow(member)) {
      return { ok: false, reason: "not_in_window" };
    }

    // 5-minute grace period after wake-up time to prevent immediate buzzing
    const wakeUpStr = getMemberWakeUpTime(member);
    if (wakeUpStr && wakeUpStr !== "--:--") {
      const [wH, wM] = wakeUpStr.split(":").map(Number);
      if (!isNaN(wH) && !isNaN(wM)) {
        const wakeTime = new Date();
        wakeTime.setHours(wH, wM, 0, 0);
        const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
        const elapsedSinceWakeUp = Date.now() - wakeTime.getTime();

        if (elapsedSinceWakeUp < gracePeriodMs) {
          return {
            ok: false,
            reason: "grace",
            timeText: formatRemainingTime(gracePeriodMs - elapsedSinceWakeUp),
          };
        }
      }
    }

    // 3-minute cooldown across the group for this member
    const buzzDocRef = doc(
      db,
      COLLECTIONS.groupBuzzes,
      `${groupId}_${member.profiles.id}`
    );
    const buzzSnap = await getDoc(buzzDocRef);
    const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes cooldown

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

  // Record the buzz and notify the target
  const performBuzz = async (member, buzzDocRef) => {
    const fromName =
      userProfile?.display_name ||
      currentUser.displayName ||
      currentUser.email ||
      t('groups.member');

    // Record buzz in Firestore so all group members respect the 3-minute cooldown between buzzes
    await setDoc(buzzDocRef, {
      group_id: groupId,
      target_user_id: member.profiles.id,
      buzzed_by_user_id: currentUser.uid,
      buzzed_by_name: fromName,
      group_name: group?.name || "",
      timestamp: Date.now(),
      buzzed_at: serverTimestamp(),
    });

    // Pass group name to the buzzed user via socket
    buzzUser(member.profiles.id, groupId, fromName, group?.name);

    // Award points for successful buzz
    await recordActivity("buzz_member");
  };

  const handleBuzzMember = async (member) => {
    if (!currentUser || !member?.profiles) return;
    try {
      const check = await checkBuzzEligibility(member);
      if (!check.ok) {
        triggerToast(getBuzzRejectionMessage(member, check), "info");
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

  // Bulk buzz: every selected member goes through the same eligibility rules,
  // then each per-user result is narrated as its own toast.
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

    // Toast is single-instance: play the per-user log one entry at a time
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
      "Remove Member",
      `Are you sure you want to remove ${
        member.profiles.display_name || member.profiles.email
      } from the group? They will be permanently barred from re-entering.`,
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

              triggerToast(
                t('groups.memberRemoved'),
                "success"
              );
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

  const openPinModal = () => {
    setPinDigits(["", "", "", ""]);
    setPinError("");
    setShowPinModal(true);
    setTimeout(() => pinRefs[0]?.current?.focus(), 200);
  };

  const handlePinDigitDetail = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError("");
    if (digit && index < 3) pinRefs[index + 1]?.current?.focus();
    if (digit && index === 3) {
      const entered = [...next.slice(0, 3), digit].join("");
      validateAndWakeUp(entered);
    }
  };

  const handlePinKeyDownDetail = (index, e) => {
    if (e.nativeEvent?.key === "Backspace" && !pinDigits[index] && index > 0) {
      pinRefs[index - 1]?.current?.focus();
    }
  };

  // Wake-up validation using PIN
  const validateAndWakeUp = async (overridePin) => {
    if (!currentUser) return;
    const entered = overridePin ?? pinDigits.join("");
    if (entered.length < 4) {
      setPinError(t('groups.enterPin'));
      return;
    }
    let savedPin = "";
    try {
      savedPin = (await AsyncStorage.getItem("suhoor_alarm_pin")) || "";
    } catch {}
    if (savedPin && entered !== savedPin) {
      setPinError("Incorrect PIN. Try again.");
      setPinDigits(["", "", "", ""]);
      setTimeout(() => pinRefs[0]?.current?.focus(), 100);
      return;
    }

    setShowPinModal(false);
    setIsBuzzing(false);
    setLoading(true);

    try {
      const todayStr = new Date().toLocaleDateString("en-CA");
      const wakeUpTime = new Date().toISOString();

      await addDoc(collection(db, COLLECTIONS.wakeUpLogs), {
        user_id: currentUser.uid,
        date: todayStr,
        woke_up_at: wakeUpTime,
      });

      // Award points for successful wake-up
      await recordActivity("wake_up", {
        minutesBeforeFajr: todayData?.minutesBeforeFajr,
      });

      const name =
        userProfile?.display_name ||
        currentUser.displayName ||
        currentUser.email ||
        "User";
      emitWakeUp(groupId, name, wakeUpTime);
      setHasWokenUp(true);
      triggerToast(t('groups.intentionRecorded'), "success");
      fetchTodayLogsAndIntentions();
    } catch (err) {
      console.error(err);
      triggerToast(t('groups.wakeUpLogError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const getWakeUpStatus = (userId) => {
    return wakeUpLogs.some((log) => log.user_id === userId);
  };

  const isOnline = (userId) => {
    return onlineMembers.includes(userId);
  };

  // Render member rows
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
                { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(61, 31, 148, 0.1)' },
                item.role === "admin" && styles.adminAvatar,
              ]}
            >
              <Text style={[styles.memberAvatarText, { color: isDark ? colors.secondary : colors.primary }]}>
                {item.profiles.display_name?.charAt(0).toUpperCase() ||
                  item.profiles.email?.charAt(0).toUpperCase()}
              </Text>
            </View>
            {isOnline(item.profiles.id) && (
              <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.surface }]} />
            )}
          </View>
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                {item.profiles.display_name ||
                  item.profiles.email.split("@")[0]}
              </Text>
              {item.role === "admin" ? (
                <View style={[styles.adminRoleBadge, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(249, 168, 38, 0.15)' }]}>
                  <Text style={[styles.adminRoleBadgeText, { color: colors.secondary }]}>Admin</Text>
                </View>
              ) : null}
              {isSelf ? (
                <View style={[styles.selfBadge, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(61, 31, 148, 0.1)' }]}>
                  <Text style={[styles.selfBadgeText, { color: isDark ? colors.secondary : colors.primary }]}>You</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.memberDetailsRow}>
              <View style={[styles.timeTag, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(21, 12, 51, 0.05)' }]}>
                <Ionicons
                  name="alarm-outline"
                  size={12}
                  color={isDark ? colors.secondary : colors.primary}
                />
                <Text style={[styles.timeTagText, { color: isDark ? colors.secondary : colors.primary }]}>{wakeUpTime}</Text>
              </View>
              {showStatus ? (
                memberStatus === "awake" ? (
                  <View style={[styles.awakeBadge, { backgroundColor: isDark ? 'rgba(0, 194, 168, 0.15)' : 'rgba(0, 194, 168, 0.1)' }]}>
                    <Text style={[styles.awakeBadgeText, { color: colors.success }]}>
                      Awake
                      {wakeUpLog
                        ? ` (${new Date(
                            wakeUpLog.woke_up_at
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })})`
                        : ""}
                    </Text>
                  </View>
                ) : memberStatus === "sleeping" && intendsToFast ? (
                  <View style={[styles.sleepingBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                    <Text style={[styles.sleepingBadgeText, { color: isDark ? '#60A5FA' : '#3B82F6' }]}>Asleep</Text>
                  </View>
                ) : memberStatus === "not_fasting" || !intendsToFast ? (
                  <View style={[styles.notFastingBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' }]}>
                    <Text style={[styles.notFastingBadgeText, { color: colors.error }]}>Not Fasting</Text>
                  </View>
                ) : null
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.memberActions}>
          {!bulkMode &&
            isMemberBuzzable(item) && (
              <TouchableOpacity
                style={[styles.buzzYellowBtn, { backgroundColor: colors.secondary }]}
                onPress={() => handleBuzzMember(item)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="notifications"
                  size={15}
                  color={colors.primary}
                />
                <Text style={[styles.buzzYellowBtnText, { color: colors.primary }]}>Buzz</Text>
              </TouchableOpacity>
            )}

          {/* 3 vertical dots action button in front of member */}
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

    // Only show bulk buzz button during wake-up window and when there are members that can be buzzed
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

      {/* Group Info Card */}
      <View style={[styles.groupHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.groupTitleRow}>
          {isEditingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { borderColor: colors.primary, color: colors.text }]}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.editSaveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveGroupName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator color={colors.onPrimaryFill} size="small" />
                ) : (
                  <Text style={[styles.editSaveText, { color: colors.onPrimaryFill }]}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editCancelBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setIsEditingName(false)}
              >
                <Text style={[styles.editCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.titleDisplayRow}>
              <Text style={[styles.groupTitleText, { color: colors.text }]}>{group?.name}</Text>
              {isCurrentUserAdmin && (
                <TouchableOpacity
                  onPress={() => setIsEditingName(true)}
                  style={styles.editIconBtn}
                >
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {isNetworkConnected && (
            <View style={[styles.liveBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)' }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.liveText, { color: colors.success }]}>Live</Text>
            </View>
          )}
        </View>

        <View style={styles.groupDetailsRow}>
          <View style={[styles.keyBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons
              name="key"
              size={12}
              color={colors.primary}
              style={styles.keyIcon}
            />
            <Text style={[styles.keyText, { color: colors.text }]}>{group?.group_key}</Text>
            <TouchableOpacity onPress={handleCopyKey} style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.membersCountText, { color: colors.textSecondary }]}>
            {members.length} {members.length === 1 ? "member" : "members"}
          </Text>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleShareKey}
          >
            <Ionicons
              name="share-social-outline"
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.shareBtnText, { color: colors.primary }]}>Invite Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleOpenSettings}
          >
            <Ionicons
              name="settings-outline"
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.shareBtnText, { color: colors.primary }]}>Settings</Text>
          </TouchableOpacity>
          {!isCurrentUserAdmin && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.05)', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}
              onPress={handleLeaveGroup}
            >
              <Ionicons name="log-out-outline" size={16} color={colors.error} />
              <Text style={[styles.leaveBtnText, { color: colors.error }]}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented Tab Bar */}
      <View style={[styles.segmentContainer, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.08)' : 'rgba(61, 31, 148, 0.08)' }]}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === "tracker" && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveTab("tracker")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="alarm-outline"
            size={16}
            color={activeTab === "tracker" ? colors.onPrimaryFill : colors.primary}
          />
          <Text
            style={[
              styles.segmentText,
              { color: colors.primary },
              activeTab === "tracker" && [styles.segmentTextActive, { color: colors.onPrimaryFill }],
            ]}
          >
            Wake Tracker
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === "members" && [styles.segmentBtnActive, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab("members")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === "members" ? colors.onPrimaryFill : colors.primary}
          />
          <Text
            style={[
              styles.segmentText,
              { color: colors.primary },
              activeTab === "members" && [styles.segmentTextActive, { color: colors.onPrimaryFill }],
            ]}
          >
            Group Info
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "tracker" ? (
        /* Tracker Card */
        <View style={[styles.trackerCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.trackerHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.trackerTitleLeft}>
              <Text style={[styles.trackerTitle, { color: colors.text }]}>{t('groups.wakeUpTracker')}</Text>
            </View>

            {hasWokenUp || currentUser ? (
              <View style={styles.awakeSuccess}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.secondary}
                />
                <Text style={[styles.awakeSuccessText, { color: colors.secondary }]}>Awake</Text>
              </View>
            ) : wantsToFast ? (
              <View style={[styles.sleepingBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                <Text style={[styles.sleepingBadgeText, { color: isDark ? '#60A5FA' : '#3B82F6' }]}>Asleep</Text>
              </View>
            ) : null}
          </View>

          {renderBulkBar()}

          {membersLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>
                {t('groups.fetchingMembers', 'Fetching members...')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              renderItem={renderMemberItem}
              contentContainerStyle={styles.membersList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      ) : (
        /* Group Info Card */
        <View style={[styles.trackerCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.trackerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.trackerTitle, { color: colors.text }]}>{t('groups.groupMembers')}</Text>
          </View>

          {renderBulkBar()}

          {membersLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>
                {t('groups.fetchingMembers', 'Fetching members...')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              renderItem={renderMemberItem}
              contentContainerStyle={styles.membersList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* Buzz Alarm Overlay Modal - Similar to main AlarmOverlay */}
      <Modal visible={isBuzzing} animationType="fade" transparent={false}>
        <View style={[styles.buzzOverlay, { backgroundColor: colors.background }]}>
          {/* Logo at top */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              columnGap: 12,
              marginBottom: 20,
            }}
          >
            <Image
              source={require("../../assets/icon-nobg.png")}
              style={{ width: 48, height: 48 }}
              resizeMode="contain"
            />
            <Text
              variant="display"
              style={{
                fontFamily: "Quicksand-Regular",
                fontWeight: "700",
                color: colors.secondary,
                fontSize: 28,
              }}
            >
              Suhoor
            </Text>
          </View>

          {/* Animated notification icon */}
          <View style={{ alignItems: "center", marginVertical: 30 }}>
            <Ionicons name="notifications" size={100} color={colors.secondary} />
          </View>

          {/* Titles */}
          <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "800",
                color: colors.text,
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              WAKE UP!
            </Text>
            <Text
              style={{
                fontSize: 18,
                color: colors.text,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              {buzzData?.fromUserName || t('groups.member')} from{" "}
              {buzzData?.groupName || t('groups.groupName')} is waking you for Suhoor!
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                textAlign: "center",
                marginTop: 16,
                paddingHorizontal: 8,
              }}
            >
              Press the button below to dismiss and check in on the Groups tab
              to stop being buzzed.
            </Text>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={[styles.buzzDismissBtn, { backgroundColor: colors.secondary }]}
            onPress={() => setIsBuzzing(false)}
          >
            <Text style={[styles.buzzDismissText, { color: colors.primary }]}>{t('common.dismiss')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* PIN Verification Modal */}
      <Modal visible={showPinModal} animationType="slide" transparent={true}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('alarm.enterPin')}</Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text
                style={[
                  styles.verificationPrompt,
                  { textAlign: "center", marginBottom: 20, color: colors.textSecondary },
                ]}
              >
                Enter your personal 4-digit PIN to confirm you are awake.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  columnGap: 12,
                  marginBottom: 12,
                }}
              >
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
                      width: 52,
                      height: 60,
                      textAlign: "center",
                      fontSize: 26,
                      fontWeight: "900",
                      borderWidth: 2,
                      borderColor: digit ? colors.primary : colors.border,
                      borderRadius: 10,
                      backgroundColor: digit
                        ? isDark ? 'rgba(251, 191, 36, 0.06)' : 'rgba(61,31,148,0.06)'
                        : colors.surfaceVariant,
                      color: colors.text,
                    }}
                  />
                ))}
              </View>
              {pinError ? (
                <Text style={[styles.dateErrorText, { textAlign: "center", color: colors.error }]}>
                  {pinError}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
              onPress={() => validateAndWakeUp()}
            >
              <Text style={[styles.modalConfirmText, { color: colors.onPrimaryFill }]}>Confirm, I'm Awake</Text>
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
              <View style={[styles.actionModalAvatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.actionModalAvatarText, { color: colors.onPrimaryFill }]}>
                  {selectedMemberForAction?.profiles?.display_name
                    ?.charAt(0)
                    .toUpperCase() ||
                    selectedMemberForAction?.profiles?.email
                      ?.charAt(0)
                      .toUpperCase() ||
                    "U"}
                </Text>
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
              {/* Buzz Option if eligible */}
              {getMemberStatus(selectedMemberForAction) === "sleeping" &&
                memberIntentions[selectedMemberForAction?.profiles?.id] !==
                  false &&
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
                      <Ionicons
                        name="notifications"
                        size={18}
                        color={colors.secondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionModalItemText,
                        { color: colors.secondary },
                      ]}
                    >
                      {t('groups.buzzMemberWakeUp')}
                    </Text>
                  </TouchableOpacity>
                )}

              {/* Copy Name */}
              <TouchableOpacity
                style={[styles.actionModalItem, { backgroundColor: colors.surfaceVariant }]}
                onPress={async () => {
                  const name =
                    selectedMemberForAction?.profiles?.display_name ||
                    selectedMemberForAction?.profiles?.email ||
                    "";
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
                  <Ionicons
                    name="copy-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.actionModalItemText, { color: colors.text }]}>Copy Member Name</Text>
              </TouchableOpacity>

              {/* Remove Member option for Admins */}
              {isCurrentUserAdmin &&
                selectedMemberForAction?.profiles?.id !== currentUser?.uid && (
                  <TouchableOpacity
                    style={[
                      styles.actionModalItem,
                      { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' },
                    ]}
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
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.error}
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionModalItemText,
                        { color: colors.error, fontWeight: "700" },
                      ]}
                    >
                      Remove Member from Group
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
  groupHeaderCard: {
    borderRadius: 20,
    padding: 16,
    margin: 16,
    marginTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  titleDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  groupTitleText: {
    fontSize: 20,
    fontWeight: "800",
  },
  editIconBtn: {
    marginLeft: 8,
    padding: 4,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    columnGap: 8,
  },
  editInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 15,
  },
  editSaveBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: "center",
  },
  editSaveText: {
    fontWeight: "700",
  },
  editCancelBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: "center",
  },
  editCancelText: {
    fontWeight: "600",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    columnGap: 4,
  },
  liveDot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  groupDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 16,
  },
  keyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  keyIcon: {
    marginRight: 4,
  },
  keyText: {
    fontSize: 11,
    fontFamily: "Quicksand-SemiBold",
    fontWeight: "600",
  },
  copyBtn: {
    padding: 2,
    marginLeft: 6,
  },
  membersCountText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actionButtonsRow: {
    flexDirection: "row",
    columnGap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    borderRadius: 8,
    columnGap: 6,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  leaderboardBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  leaveBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  // Tracker Card
  trackerCard: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
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
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    columnGap: 4,
    alignSelf: "flex-start",
  },
  locationBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  wakeUpBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    columnGap: 6,
  },
  wakeUpBtnText: {
    fontSize: 13,
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
    paddingVertical: 12,
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
  adminAvatar: {
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
  awakeBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  awakeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  notFastingBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  notFastingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  sleepingBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  sleepingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  memberDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginTop: 4,
  },
  memberDetailText: {
    fontSize: 11,
    flexDirection: "row",
    alignItems: "center",
  },
  memberEmail: {
    fontSize: 11,
    marginTop: 2,
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
  findBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    columnGap: 4,
  },
  findText: {
    fontSize: 10,
    fontWeight: "700",
  },
  removeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  // Buzz Alarm Overlay
  buzzOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    paddingTop: 80,
  },
  buzzDismissBtn: {
    borderWidth: 2,
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 16,
    marginTop: 40,
    marginBottom: 60,
    width: "100%",
    maxWidth: 280,
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  buzzDismissText: {
    fontSize: 20,
    fontWeight: "800",
  },
  // Date Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalContent: {
    marginBottom: 20,
  },
  verificationPrompt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  dateInput: {
    borderWidth: 2,
    borderRadius: 10,
    height: 48,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
  },
  dateErrorText: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
  },
  modalConfirmBtn: {
    height: 46,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalConfirmText: {
    fontWeight: "700",
    fontSize: 14,
  },
  segmentContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 4,
    columnGap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    columnGap: 6,
  },
  segmentBtnActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    fontWeight: "700",
  },
  adminRoleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  adminRoleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  selfBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  selfBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeTagText: {
    fontSize: 11,
    fontWeight: "600",
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
  actionModalItemDanger: {
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
  // Bulk buzz bar
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
});

export default GroupDetailScreen;
