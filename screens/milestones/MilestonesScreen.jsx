import React, { useState } from "react";
import { StyleSheet, View, RefreshControl } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useGamification } from "../../hooks/useGamification";
import { BADGE_TRACKS, BARAKAH_TIERS } from "../../config/firestoreSchema";
import { Badge, Card, Screen, Text } from "../../components/ui";
import { alpha, radius, spacing } from "../../theme";
import GamificationCelebration from "../../components/GamificationCelebration";

export const MilestonesScreen = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const {
    stats,
    currentLevel,
    nextTier,
    progressPercent,
    celebration,
    dismissCelebration,
  } = useGamification();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Lifetime Badge Tracks
  const tracks = Object.values(BADGE_TRACKS);

  // Flatten unlocked badges from user's achieved badges
  const unlockedBadges = [];
  const nextTargetBadges = [];

  tracks.forEach((track) => {
    let highestUnlocked = null;
    let nextLocked = null;

    for (const level of track.levels) {
      if (stats.badges.includes(level.badgeId)) {
        highestUnlocked = { ...level, track };
        unlockedBadges.push({ ...level, track });
      } else if (!nextLocked) {
        nextLocked = { ...level, track };
      }
    }

    if (nextLocked) {
      nextTargetBadges.push(nextLocked);
    }
  });

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
      <GamificationCelebration
        celebration={celebration}
        onDismiss={dismissCelebration}
      />
      <View style={styles.scrollContent}>
        
        {/* Level Card */}
        <Card style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View
              style={[
                styles.levelIcon,
                { backgroundColor: alpha(colors.primary, 0.1) },
              ]}
            >
              <Text style={styles.levelEmoji}>{currentLevel.icon}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text variant="h3" style={styles.levelTitle}>
                {t('milestones.levelTitle', { level: currentLevel.level, name: currentLevel.name })}
              </Text>
              <Text variant="caption" tone="secondary">
                <Text style={{ fontWeight: "800", color: colors.text }}>
                  {stats.points}
                </Text>{" "}
                {t('milestones.suhoorPoints', 'Suhoor Points')}
              </Text>
            </View>
          </View>

          {nextTier && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text variant="caption" tone="secondary">
                  {t('milestones.pointsToNext', { points: nextTier.minPoints - stats.points, name: nextTier.name })}
                </Text>
                <Text variant="caption" tone="primary" style={styles.bold}>
                  {progressPercent}%
                </Text>
              </View>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${progressPercent}%`,
                    },
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
                {stats.totalFastingDays}
              </Text>
              <Text variant="caption" tone="secondary" style={styles.statLabel}>
                {t('milestones.fastingDays', 'Fasting Days')}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            
            <View style={styles.statItem}>
              <Text variant="h3" tone="primary" style={styles.statValue}>
                {stats.earlyBirds}
              </Text>
              <Text variant="caption" tone="secondary" style={styles.statLabel}>
                {t('milestones.earlyBirds', 'Early Birds')}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            
            <View style={styles.statItem}>
              <Text variant="h3" tone="primary" style={styles.statValue}>
                {stats.membersBuzzed}
              </Text>
              <Text variant="caption" tone="secondary" style={styles.statLabel}>
                {t('milestones.membersBuzzed', 'Members Buzzed')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Lifetime Badge Tracks */}
        <Card>
          <View style={styles.sectionHeader}>
            <Text variant="h3">{t('milestones.unlockedBadges', 'Unlocked Badges')}</Text>
            <Badge label={`${unlockedBadges.length}`} tone="primary" />
          </View>

          {unlockedBadges.length === 0 ? (
            <Text variant="caption" tone="secondary" style={{ fontStyle: 'italic', paddingVertical: 8 }}>
              {t('milestones.noBadgesYet', 'Check in for your first suhoor to unlock your first badge!')}
            </Text>
          ) : (
            <View style={styles.badgesGrid}>
              {unlockedBadges.map((badge) => (
                <View
                  key={badge.badgeId}
                  style={[
                    styles.badgeCard,
                    { backgroundColor: alpha(colors.primary, 0.05) },
                  ]}
                >
                  <Text style={styles.badgeEmoji}>{badge.track.icon}</Text>
                  <Text variant="label" style={styles.badgeTitle}>
                    {badge.title}
                  </Text>
                  <Text
                    variant="caption"
                    tone="secondary"
                    style={styles.badgeDescription}
                    numberOfLines={2}
                  >
                    {t('milestones.badgeLevelUnit', { level: badge.level, requirement: badge.requirement, unit: badge.track.unit })}
                  </Text>
                  <View style={styles.badgePoints}>
                    <Ionicons name="star" size={12} color={colors.primary} />
                    <Text
                      variant="caption"
                      tone="primary"
                      style={styles.badgePointsText}
                    >
                      +{badge.points}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Upcoming Targets (Locked) */}
        {nextTargetBadges.length > 0 && (
          <Card>
            <View style={styles.sectionHeader}>
              <Text variant="h3">{t('milestones.lockedBadges', 'Locked Badges')}</Text>
              <Badge label={`${nextTargetBadges.length}`} tone="secondary" />
            </View>
            <View style={styles.badgesGrid}>
              {nextTargetBadges.map((badge) => (
                <View
                  key={badge.badgeId}
                  style={[
                    styles.badgeCard,
                    styles.lockedBadge,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Text style={[styles.badgeEmoji, styles.lockedEmoji]}>
                    {badge.track.icon}
                  </Text>
                  <Text
                    variant="label"
                    style={[styles.badgeTitle, styles.lockedText]}
                  >
                    {badge.title}
                  </Text>
                  <Text
                    variant="caption"
                    tone="secondary"
                    style={[styles.badgeDescription, styles.lockedText]}
                    numberOfLines={2}
                  >
                    {t('milestones.badgeRequires', { requirement: badge.requirement, unit: badge.track.unit })}
                  </Text>
                  <View style={styles.badgePoints}>
                    <Ionicons name="star" size={12} color={colors.muted} />
                    <Text
                      variant="caption"
                      tone="secondary"
                      style={styles.badgePointsText}
                    >
                      +{badge.points}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.lockOverlay,
                      { backgroundColor: alpha(colors.text, 0.05) },
                    ]}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={16}
                      color={colors.muted}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* All Barakah Levels */}
        <Card>
          <View style={styles.sectionHeader}>
            <Text variant="h3">{t('milestones.allLevels', 'All Levels')}</Text>
          </View>
          <View style={styles.levelsList}>
            {BARAKAH_TIERS.map((tier) => {
              const isUnlocked = stats.points >= tier.minPoints;
              const isCurrent = currentLevel.level === tier.level;

              return (
                <View
                  key={tier.level}
                  style={[
                    styles.levelRow,
                    isCurrent && {
                      backgroundColor: alpha(colors.primary, 0.08),
                    },
                    { borderTopColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.levelBadge,
                      {
                        backgroundColor: isUnlocked
                          ? alpha(colors.primary, 0.1)
                          : colors.surfaceVariant,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.levelBadgeEmoji,
                        isUnlocked ? null : styles.lockedEmoji,
                      ]}
                    >
                      {isUnlocked ? tier.icon : "🔒"}
                    </Text>
                  </View>
                  <View style={styles.levelMeta}>
                    <View style={styles.levelNameRow}>
                      <Text
                        variant="label"
                        style={[
                          styles.levelName,
                          isUnlocked ? null : styles.lockedText,
                        ]}
                      >
                        {t('milestones.levelTitle', { level: tier.level, name: tier.name })}
                      </Text>
                      {isCurrent && (
                        <Badge label={t('milestones.current', 'Current')} tone="primary" size="sm" />
                      )}
                    </View>
                    <Text variant="caption" tone="secondary">
                      {t('milestones.pointsRequired', { points: tier.minPoints })}
                    </Text>
                  </View>
                  {isUnlocked && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    rowGap: 18,
  },
  bold: {
    fontWeight: "700",
  },
  levelCard: {},
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: spacing.lg,
    rowGap: spacing.lg,
  },
  levelIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  statsCard: {},
  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  badgeCard: {
    flex: 1,
    flexBasis: "45%",
    maxWidth: "50%",
    borderRadius: radius.lg,
    padding: spacing.md,
    position: "relative",
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
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    columnGap: spacing.xs,
  },
  badgePointsText: {
    fontSize: 11,
    fontWeight: "600",
  },
  lockOverlay: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  levelsList: {
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeEmoji: {
    fontSize: 22,
  },
  levelMeta: {
    flex: 1,
  },
  levelNameRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: spacing.md,
    rowGap: spacing.md,
    marginBottom: spacing.sm,
  },
  levelName: {
    fontWeight: "600",
  },
});

export default MilestonesScreen;
