/**
 * Celebration bus.
 *
 * Why this exists: `useGamification()` holds `celebration` in local hook state,
 * and it is instantiated in five components. `recordActivity()` sets that state
 * on the instance that called it — and a check-in records activity from
 * GroupsScreen, which does not render the confetti at all. HomeScreen renders
 * the confetti but never records activity, so a level-up could never reach it.
 *
 * The result was confetti that only ever appeared on the Group Detail screen
 * after a buzz, and level-ups from checking in celebrated nowhere.
 *
 * This bus is the smallest fix that makes the celebration independent of which
 * screen happened to record the activity: whoever earns it publishes, one host
 * component at the app root renders it.
 *
 * Delivery is fire-and-forget. There is exactly one subscriber (the host), and a
 * listener that throws must never break the activity recording that published.
 */
const listeners = new Set()

/**
 * @param {{kind: 'level'|'badge', level?: number, name: string, points?: number, icon?: string, badgeTitle?: string}} payload
 */
export const publishCelebration = (payload) => {
  if (!payload) return
  for (const listener of listeners) {
    try {
      listener(payload)
    } catch (error) {
      console.warn('Celebration listener failed:', error)
    }
  }
}

/**
 * @param {(payload: object) => void} listener
 * @returns {() => void} unsubscribe
 */
export const subscribeCelebration = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export default { publishCelebration, subscribeCelebration }
