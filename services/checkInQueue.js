import AsyncStorage from '@react-native-async-storage/async-storage'
import { db } from '../config/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { COLLECTIONS, wakeUpLogId } from '../config/firestoreSchema'

/**
 * Offline check-in queue.
 *
 * A check-in writes two Firestore documents (the wake-up log and the daily
 * fasting status). With no connection both fail, and the user — who did press
 * the button, at 3am, half asleep — was told nothing worked. Their check-in is
 * what tells the group they are awake, so losing it is not acceptable.
 *
 * So a check-in is always recorded locally first and treated as done in the UI.
 * If Firestore cannot take it, it is queued here and flushed the next time the
 * app has a connection, exactly once per (user, day).
 */

const QUEUE_KEY = 'suhoor_pending_checkins'

const readQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

const writeQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.warn('Could not persist the check-in queue:', e?.message || e)
  }
}

/** The two documents a check-in always writes. Throws when offline. */
export const writeCheckIn = async ({ userId, dateKey, wokeUpAt }) => {
  const when = wokeUpAt || new Date().toISOString()

  await setDoc(
    doc(db, COLLECTIONS.wakeUpLogs, wakeUpLogId(userId, dateKey)),
    { user_id: userId, date: dateKey, woke_up_at: when },
    { merge: true }
  )

  await setDoc(
    doc(db, COLLECTIONS.dailyFastingStatus, `${userId}_${dateKey}`),
    {
      userId,
      date: dateKey,
      wantsToFast: true,
      checkedIn: true,
      wokeUpAt: when,
    },
    { merge: true }
  )

  return when
}

/** Adds (or replaces) this user's pending check-in for the day. */
export const queueCheckIn = async ({ userId, dateKey, wokeUpAt }) => {
  if (!userId || !dateKey) return false
  const queue = await readQueue()
  const rest = queue.filter(
    (entry) => !(entry.userId === userId && entry.dateKey === dateKey)
  )
  rest.push({ userId, dateKey, wokeUpAt: wokeUpAt || new Date().toISOString() })
  await writeQueue(rest)
  return true
}

export const hasPendingCheckIn = async (userId, dateKey) => {
  if (!userId || !dateKey) return false
  const queue = await readQueue()
  return queue.some((entry) => entry.userId === userId && entry.dateKey === dateKey)
}

/**
 * Tries to write every queued check-in. Anything that still fails stays queued.
 * @returns {Promise<number>} how many were flushed
 */
export const flushPendingCheckIns = async () => {
  const queue = await readQueue()
  if (queue.length === 0) return 0

  const remaining = []
  let flushed = 0

  for (const entry of queue) {
    try {
      await writeCheckIn(entry)
      flushed += 1
    } catch (error) {
      remaining.push(entry)
    }
  }

  await writeQueue(remaining)
  return flushed
}

export default { writeCheckIn, queueCheckIn, flushPendingCheckIns, hasPendingCheckIn }
