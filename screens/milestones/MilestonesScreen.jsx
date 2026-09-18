import React, { useState, useEffect } from 'react'
import { StyleSheet, View, RefreshControl } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { useGamification } from '../../hooks/useGamification'
import { BADGES, BARAKAH_TIERS } from '../../config/firestoreSchema'
import { Badge, Card, Screen, Text } from '../../components/ui'
import { alpha, radius, spacing } from '../../theme'

export const MilestonesScreen = () => {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { stats, currentLevel, nextTier, progressPercent, loading } = useGamification()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
  }

  const allBadges = Object.values(BADGES)
  const unlockedBadges = allBadges.filter(badge => stats.badges.includes(badge.id))
  const lockedBadges = allBadges.filter(badge => !stats.badges.includes(badge.id))

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
      {/* A plain View, not a ScrollView: `Screen` already scrolls and owns the
          RefreshControl, and a nested vertical ScrollView swallowed both the
          pull-to-refresh gesture and the frame's top padding. */}
      <View style={styles.scrollContent}>
        {/* Current Level Card */}
        <Card style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={[styles.levelIcon, { backgroundColor: alpha(colors.primary, 0.1) }]}>
              <Text style={styles.levelEmoji}>{currentLevel.icon}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text variant="h3" style={styles.levelTitle}>
                Level {currentLevel.level} • {currentLevel.name}
              </Text>
              <Text variant="caption" tone="secondary">
                {stats.points} SP
              </Text>
            </View>
          </View>

          {nextTier && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text variant="caption" tone="secondary">
                  {nextTier.minPoints - stats.points} points to {nextTier.name}
                </Text>
                <Text variant="caption" tone="primary" style={styles.bold}>
                  {progressPercent}%
                </Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: `${progressPercent}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Stats Overview */}
        <Card style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="h3" tone="primary" style={styles.statValue}>
                {stats.successfulWakeups}
              </Text>
              <Text variant="caption" tone="secondary" style={styles.statLabel}>
                Wake-ups
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text variant="h3" tone="primary" style={styles.statValue}>
                {stats.totalFastingDays}
              </Text>
              <Text variant="caption" tone="secondary" style={styles.statLabel}>
                Fasting Days
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text variant="h3" tone="primary" style={styles.statValue}>
                {stats.membersBuzzed}
              </Text>
              <Text variant="caption" tone="secondary" style={styles.statLabel}>
                Members Buzzed
              </Text>
            </View>
          </View>
        </Card>

        {/* Unlocked Badges */}
        {unlockedBadges.length > 0 && (
          <Card>
            <View style={styles.sectionHeader}>
              <Text variant="h3">Unlocked Badges</Text>
              <Badge label={`${unlockedBadges.length}`} tone="primary" />
            </View>
            <View style={styles.badgesGrid}>
              {unlockedBadges.map(badge => (
                <View key={badge.id} style={[styles.badgeCard, { backgroundColor: alpha(colors.primary, 0.05) }]}>
                  <Text style={styles.badgeEmoji}>{badge.icon}</Text>
                  <Text variant="label" style={styles.badgeTitle}>
                    {badge.title}
                  </Text>
                  <Text variant="caption" tone="secondary" style={styles.badgeDescription} numberOfLines={2}>
                    {badge.description}
                  </Text>
                  <View style={styles.badgePoints}>
                    <Ionicons name="star" size={12} color={colors.primary} />
                    <Text variant="caption" tone="primary" style={styles.badgePointsText}>
                      +{badge.points}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Locked Badges */}
        {lockedBadges.length > 0 && (
          <Card>
            <View style={styles.sectionHeader}>
              <Text variant="h3">Locked Badges</Text>
              <Badge label={`${lockedBadges.length}`} tone="secondary" />
            </View>
            <View style={styles.badgesGrid}>
              {lockedBadges.map(badge => (
                <View key={badge.id} style={[styles.badgeCard, styles.lockedBadge, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.badgeEmoji, styles.lockedEmoji]}>{badge.icon}</Text>
                  <Text variant="label" style={[styles.badgeTitle, styles.lockedText]}>
                    {badge.title}
                  </Text>
                  <Text variant="caption" tone="secondary" style={[styles.badgeDescription, styles.lockedText]} numberOfLines={2}>
                    {badge.description}
                  </Text>
                  <View style={styles.badgePoints}>
                    <Ionicons name="star" size={12} color={colors.muted} />
                    <Text variant="caption" tone="secondary" style={styles.badgePointsText}>
                      +{badge.points}
                    </Text>
                  </View>
                  <View style={[styles.lockOverlay, { backgroundColor: alpha(colors.text, 0.05) }]}>
                    <Ionicons name="lock-closed" size={16} color={colors.muted} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* All Levels */}
        <Card>
          <View style={styles.sectionHeader}>
            <Text variant="h3">All Levels</Text>
          </View>
          <View style={styles.levelsList}>
            {BARAKAH_TIERS.map(tier => {
              const isUnlocked = stats.points >= tier.minPoints
              const isCurrent = currentLevel.level === tier.level
              
              return (
                <View
                  key={tier.level}
                  style={[
                    styles.levelRow,
                    isCurrent && { backgroundColor: alpha(colors.primary, 0.08) },
                    { borderTopColor: colors.border },
                  ]}
                >
                  <View style={[styles.levelBadge, { backgroundColor: isUnlocked ? alpha(colors.primary, 0.1) : colors.surfaceVariant }]}>
                    <Text style={[styles.levelBadgeEmoji, isUnlocked ? null : styles.lockedEmoji]}>
                      {isUnlocked ? tier.icon : '🔒'}
                    </Text>
                  </View>
                  <View style={styles.levelMeta}>
                    <View style={styles.levelNameRow}>
                      <Text variant="label" style={[styles.levelName, isUnlocked ? null : styles.lockedText]}>
                        Level {tier.level} • {tier.name}
                      </Text>
                      {isCurrent && (
                        <Badge label="Current" tone="primary" size="sm" />
                      )}
                    </View>
                    <Text variant="caption" tone="secondary">
                      {tier.minPoints} points required
                    </Text>
                  </View>
                  {isUnlocked && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </View>
              )
            })}
          </View>
        </Card>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    // Screen's contentContainer already supplies the gutter and its `rowGap`
    // only reaches its own direct children, so the section spacing is repeated
    // here for the cards inside this wrapper.
    rowGap: 18,
  },
  bold: {
    fontWeight: '700',
  },

  // Level Card
  levelCard: {},
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.lg,
  },
  levelIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelEmoji: {
    fontSize: 28,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    marginBottom: spacing.sm,
  },
  progressSection: {
    marginTop: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },

  // Stats Card
  statsCard: {},
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },

  // Badges Grid
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  badgeCard: {
    width: '45%',
    borderRadius: radius.lg,
    padding: spacing.md,
    position: 'relative',
  },
  lockedBadge: {
    opacity: 0.6,
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: spacing.md,
  },
  lockedEmoji: {
    opacity: 0.4,
  },
  badgeTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  lockedText: {
    opacity: 0.5,
  },
  badgeDescription: {
    fontSize: 11,
    marginBottom: spacing.md,
  },
  badgePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
  },
  badgePointsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lockOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Levels List
  levelsList: {
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeEmoji: {
    fontSize: 22,
  },
  levelMeta: {
    flex: 1,
  },
  levelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
    marginBottom: spacing.sm,
  },
  levelName: {
    fontWeight: '600',
  },
})

export default MilestonesScreen