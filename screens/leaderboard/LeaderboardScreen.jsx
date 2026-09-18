import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { Badge, Card, Screen, Text } from '../../components/ui'
import { alpha, radius, spacing } from '../../theme'

/**
 * The mobile Leaderboard — shows groups ranked by SuhoorPoints.
 *
 * SuhoorPoints = total fasting days of all group members combined.
 * Groups are sorted by SuhoorPoints in descending order.
 */

export const LeaderboardScreen = () => {
  const { currentUser } = useAuth()
  const { colors } = useTheme()
  const { t } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [groups, setGroups] = useState([])

  const fetchLeaderboard = useCallback(async () => {
    if (!currentUser) return

    try {
      // Fetch all groups
      const groupsSnap = await getDocs(collection(db, 'groups'))
      
      // Fetch all group members
      const membersSnap = await getDocs(collection(db, 'group_members'))
      
      // Fetch all completed check-ins (wantsToFast === true) — source of truth
      const checkInsSnap = await getDocs(
        query(collection(db, 'daily_fasting_status'), where('wantsToFast', '==', true))
      )

      // Build a map of user_id -> count of completed fasts
      const completedFastsMap = {}
      checkInsSnap.docs.forEach(doc => {
        const uid = doc.data().userId
        if (uid) {
          completedFastsMap[uid] = (completedFastsMap[uid] || 0) + 1
        }
      })

      // Build a map of group_id -> member_ids
      const groupMembersMap = {}
      membersSnap.docs.forEach(doc => {
        const data = doc.data()
        const groupId = data.group_id
        const userId = data.user_id
        if (!groupMembersMap[groupId]) {
          groupMembersMap[groupId] = []
        }
        groupMembersMap[groupId].push(userId)
      })

      // Calculate SuhoorPoints for each group: sum of completed fasts by all members
      // Only include groups where the admin set show_on_leaderboard === true
      const compiled = groupsSnap.docs
        .map(groupDoc => {
          const groupData = groupDoc.data()
          const groupId = groupDoc.id
          const memberIds = groupMembersMap[groupId] || []
          
          let suhoorPoints = 0
          memberIds.forEach(userId => {
            suhoorPoints += completedFastsMap[userId] || 0
          })

          return {
            id: groupId,
            name: groupData.name || 'Unnamed Group',
            group_key: groupData.group_key || '',
            memberCount: memberIds.length,
            suhoorPoints,
            show_on_leaderboard: groupData.show_on_leaderboard || false,
            isCurrentUserGroup: memberIds.includes(currentUser?.uid),
          }
        })
        .filter(group => group.show_on_leaderboard === true)

      // Sort by SuhoorPoints descending
      compiled.sort((a, b) => b.suhoorPoints - a.suhoorPoints)

      setGroups(compiled)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentUser])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const onRefresh = () => {
    setRefreshing(true)
    fetchLeaderboard()
  }

  const currentUserGroup = useMemo(() => {
    const found = groups.find(g => g.isCurrentUserGroup)
    if (found) {
      const rankIndex = groups.findIndex(g => g.id === found.id)
      return {
        ...found,
        rank: rankIndex !== -1 ? rankIndex + 1 : 1,
      }
    }
    return null
  }, [groups])

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Your group's standing */}
      {currentUserGroup && (
        <Card>
          <View style={styles.meRow}>
            <View
              style={[
                styles.tierGlyph,
                { backgroundColor: alpha(colors.primary, 0.08) },
              ]}
            >
              <Text style={styles.tierEmoji}>#{currentUserGroup.rank}</Text>
            </View>

            <View style={styles.meMeta}>
              <View style={styles.meNameRow}>
                <Text variant="h3" numberOfLines={1} style={styles.meName}>
                  {currentUserGroup.name}
                </Text>
                <Badge label="Your Group" tone="primary" bordered />
              </View>

              <View style={styles.meStats}>
                <Text variant="caption" tone="primary" style={styles.bold}>
                  {currentUserGroup.suhoorPoints} SP
                </Text>
                <Text variant="caption" tone="secondary">
                  {currentUserGroup.memberCount} members
                </Text>
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* The board */}
      <Card padded={false}>
        <View style={[styles.boardHeader, { borderBottomColor: colors.border }]}>
          <Text variant="h3">Group Leaderboard</Text>
          {!loading && (
            <Text variant="caption" tone="secondary">
              {groups.length} groups
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.rowStack}>
            {Array.from({ length: 5 }, (unused, index) => (
              <View key={index} style={styles.skeletonRow}>
                <View
                  style={[
                    styles.skeletonAvatar,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                />
                <View style={styles.skeletonText}>
                  <View
                    style={[
                      styles.skeletonLine,
                      { backgroundColor: colors.surfaceVariant, width: '55%' },
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonLine,
                      { backgroundColor: colors.surfaceVariant, width: '30%' },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={colors.muted} />
            <Text variant="body" tone="secondary" style={[styles.emptyText, { textAlign: 'center', paddingHorizontal: 20 }]}>
              No groups want to be displayed in leaderboard.
            </Text>
          </View>
        ) : (
          <View>
            {groups.map((group, index) => {
              const rank = index + 1
              const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[rank]

              return (
                <View
                  key={group.id}
                  style={[
                    styles.memberRow,
                    { borderTopColor: colors.border },
                    index === 0 && styles.firstRow,
                    group.isCurrentUserGroup && {
                      backgroundColor: alpha(colors.primary, 0.05),
                    },
                  ]}
                >
                  <Text
                    variant={medal ? 'h3' : 'caption'}
                    tone={medal ? 'default' : 'muted'}
                    style={styles.rank}
                  >
                    {medal ?? `#${rank}`}
                  </Text>

                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: alpha(colors.primary, 0.1),
                        borderColor: alpha(colors.primary, 0.2),
                      },
                    ]}
                  >
                    <Text variant="label" tone="primary">
                      {group.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberMeta}>
                    <View style={styles.memberNameRow}>
                      <Text variant="label" numberOfLines={1} style={styles.flex}>
                        {group.name}
                      </Text>
                      {group.isCurrentUserGroup && (
                        <Badge label="Your Group" tone="primary" size="sm" />
                      )}
                    </View>
                    <Text variant="caption" tone="secondary">
                      {group.memberCount} members
                    </Text>
                  </View>

                  <View style={styles.points}>
                    <Text variant="label" numberOfLines={1} style={styles.bold}>
                      ⭐ {group.suhoorPoints} SP
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },

  // Your standing
  meRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  tierGlyph: {
    width: 46,
    height: 46,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierEmoji: {
    fontSize: 22,
  },
  meMeta: {
    flex: 1,
    columnGap: spacing.xs,
    rowGap: spacing.xs,
  },
  meNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  meName: {
    flexShrink: 1,
  },
  meStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  tierFooter: {
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radius.pill,
  },

  // Filters
  filters: {
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  toggleGroup: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.xl,
    columnGap: 3,
    rowGap: 3,
  },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.xs,
    rowGap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  // Board
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    borderBottomWidth: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderTopWidth: 1,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  rank: {
    width: 28,
    textAlign: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberMeta: {
    flex: 1,
    columnGap: spacing.xxs,
    rowGap: spacing.xxs,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  points: {
    alignItems: 'flex-end',
  },

  // Board placeholder / empty
  rowStack: {
    padding: spacing.base,
    columnGap: spacing.base,
    rowGap: spacing.base,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  skeletonAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
  },
  skeletonText: {
    flex: 1,
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  skeletonLine: {
    height: 10,
    borderRadius: radius.sm,
  },
  empty: {
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.base,
  },
  emptyText: {
    textAlign: 'center',
  },
})

export default LeaderboardScreen
