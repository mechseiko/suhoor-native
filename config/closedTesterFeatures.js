/**
 * Temporary product surface for the closed-testing build.
 *
 * Keep alarm delivery enabled: it is the app's core wake-up experience. These
 * flags only remove unfinished or feedback-heavy entry points until the public
 * release. Restore a feature by changing its value to true.
 */
export const CLOSED_TESTER_FEATURES = Object.freeze({
  customAlarmAudio: false,
  fastingPrompt: false,
  fastingPromptReminder: false,
  notificationCenter: false,
  leaderboard: false,
  groups: false,
})

export default CLOSED_TESTER_FEATURES
