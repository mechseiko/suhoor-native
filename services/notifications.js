import { Platform } from 'react-native'

/**
 * Local notifications for the mobile app.
 *
 * Replaces expo-notifications, which was imported in two files but never a
 * dependency of this project — the bundle could not build. The declared
 * dependency is react-native-push-notification, so that is what this wraps.
 *
 * Everything goes through this one module because react-native-push-notification
 * is configured globally: two `configure()` calls from two files would have the
 * second silently replace the first's handler. Here `configure` runs at most once
 * and notifications fan out to any number of subscribers.
 *
 * iOS additionally needs @react-native-community/push-notification-ios, which is
 * not installed. The require below is therefore lazy and guarded: on Android
 * everything works; on iOS scheduling degrades to a no-op with a warning rather
 * than crashing the bundle. Add that package before shipping iOS.
 */

export const CHANNELS = {
  wakeUp: { id: 'suhoor-wake-up', name: 'Suhoor Wake Up' },
  recheck: { id: 'suhoor-recheck', name: 'Suhoor Recheck' },
  fastingPrompt: { id: 'suhoor-fasting-prompt', name: 'Fasting Intention' },
  suhoorStart: { id: 'suhoor-start', name: 'Suhoor Time' },
  suhoorEnd: { id: 'suhoor-end', name: 'Suhoor Ending' },
  iftar: { id: 'suhoor-iftar', name: 'Iftar Time' },
  iftarReminder: { id: 'suhoor-iftar-reminder', name: 'Iftar Reminder' },
}

let pushNotification = null
let loadAttempted = false
let configured = false
const createdChannels = new Set()
const subscribers = new Set()

/** Lazily resolves the native module; returns null when unavailable. */
const getModule = () => {
  if (loadAttempted) return pushNotification
  loadAttempted = true
  if (Platform.OS === 'web') return null
  try {
    // eslint-disable-next-line global-require
    pushNotification =
      require('react-native-push-notification').default ??
      require('react-native-push-notification')
  } catch (error) {
    console.warn(
      'react-native-push-notification unavailable — local alarms are disabled on this platform:',
      error?.message
    )
    pushNotification = null
  }
  return pushNotification
}

export const isAvailable = () => getModule() !== null

/**
 * Notification payloads arrive under different keys per platform
 * (`userInfo` on iOS, `data` on Android). Normalised here so callers read one
 * shape.
 */
const payloadOf = notification =>
  notification?.data ?? notification?.userInfo ?? {}

/**
 * Configures the native module once and starts fanning notifications out to
 * subscribers. Safe to call from anywhere, any number of times.
 */
export const configureNotifications = () => {
  if (configured) return
  const Push = getModule()
  if (!Push) return

  Push.configure({
    onNotification: notification => {
      const data = payloadOf(notification)
      for (const listener of subscribers) {
        try {
          listener(data, notification)
        } catch (error) {
          console.error('Notification subscriber threw:', error)
        }
      }
      // iOS requires the fetch result to be reported back.
      notification?.finish?.('backgroundFetchResultNoData')
    },
    // iOS asks at configure time; Android permissions are handled by the OS or,
    // for exact alarms, by the native alarm module.
    requestPermissions: Platform.OS === 'ios',
    popInitialNotification: true,
  })

  configured = true
}

/**
 * Adds a notification listener. Returns an unsubscribe function, matching the
 * shape React effects expect.
 */
export const subscribeToNotifications = listener => {
  configureNotifications()
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

/** Creates an Android channel once. No-op on iOS. */
export const ensureChannel = async ({ id, name }) => {
  if (Platform.OS !== 'android') return true
  if (createdChannels.has(id)) return true

  const Push = getModule()
  if (!Push) return false

  return new Promise(resolve => {
    Push.createChannel(
      {
        channelId: id,
        channelName: name,
        importance: 4, // IMPORTANCE_HIGH — a wake-up alarm must break through
        vibrate: true,
        playSound: true,
        soundName: 'default',
      },
      created => {
        createdChannels.add(id)
        resolve(created)
      }
    )
  })
}

export const checkPermissions = () =>
  new Promise(resolve => {
    const Push = getModule()
    if (!Push) {
      resolve({ alert: false, badge: false, sound: false })
      return
    }
    Push.checkPermissions(permissions => resolve(permissions ?? {}))
  })

export const requestPermissions = async () => {
  const Push = getModule()
  if (!Push) return false
  try {
    const result = await Push.requestPermissions()
    // Android returns undefined here: the OS grants POST_NOTIFICATIONS via the
    // manifest prompt, so treat "no answer" as granted rather than as denied.
    if (result === undefined) return Platform.OS === 'android'
    return Boolean(result?.alert ?? result)
  } catch (error) {
    console.warn('Notification permission request failed:', error)
    return false
  }
}

/**
 * Schedules a one-shot local notification.
 *
 * `id` must be a numeric string on Android; callers pass a semantic id, so it is
 * hashed to a stable positive 31-bit integer here — the same semantic id always
 * maps to the same native id, which is what makes cancelling by name work.
 */
export const notificationIdFor = semanticId => {
  let hash = 0
  for (let index = 0; index < semanticId.length; index += 1) {
    hash = (hash * 31 + semanticId.charCodeAt(index)) | 0
  }
  return String(Math.abs(hash) || 1)
}

export const scheduleNotification = async ({
  semanticId,
  date,
  title,
  message,
  channel = CHANNELS.wakeUp,
  data = {},
  soundName = 'default',
}) => {
  const Push = getModule()
  if (!Push) return null

  await ensureChannel(channel)
  const id = notificationIdFor(semanticId)

  try {
    Push.localNotificationSchedule({
      id,
      channelId: channel.id,
      title,
      message,
      date: date instanceof Date ? date : new Date(date),
      allowWhileIdle: true, // survives Doze — the whole point of a suhoor alarm
      playSound: true,
      soundName,
      vibrate: true,
      vibration: 1000,
      importance: 'high',
      priority: 'high',
      userInfo: { ...data, semanticId },
    })
    return id
  } catch (error) {
    console.error('Failed to schedule notification:', error)
    return null
  }
}

export const cancelNotification = semanticIdOrId => {
  const Push = getModule()
  if (!Push) return false
  try {
    // Accept either a semantic id or an already-hashed native id.
    const id = /^\d+$/.test(semanticIdOrId)
      ? semanticIdOrId
      : notificationIdFor(semanticIdOrId)
    Push.cancelLocalNotification(id)
    return true
  } catch (error) {
    console.error('Failed to cancel notification:', error)
    return false
  }
}

export const getScheduledNotifications = () =>
  new Promise(resolve => {
    const Push = getModule()
    if (!Push) {
      resolve([])
      return
    }
    Push.getScheduledLocalNotifications(notifications =>
      resolve(notifications ?? [])
    )
  })

export default {
  CHANNELS,
  isAvailable,
  configureNotifications,
  subscribeToNotifications,
  ensureChannel,
  checkPermissions,
  requestPermissions,
  scheduleNotification,
  cancelNotification,
  getScheduledNotifications,
  notificationIdFor,
}
