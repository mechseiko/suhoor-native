import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { scheduleNotification, CHANNELS } from '../services/notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { db } from '../config/firebase'
import { COLLECTIONS } from '../config/firestoreSchema'
import { doc, getDoc } from 'firebase/firestore'

/**
 * Headless manager component for fasting notifications.
 * Schedules daily 5PM fasting intention reminder for users who haven't set their intention.
 * Also triggers if app is opened after 5PM and intention for tomorrow is still not set.
 */
export const FastingNotificationsManager = () => {
  const { currentUser } = useAuth()
  const { t } = useLanguage()
  const [hasScheduledToday, setHasScheduledToday] = useState(false)

  useEffect(() => {
    if (!currentUser || Platform.OS === 'web' || hasScheduledToday) return

    const scheduleFastingReminder = async () => {
      try {
        const now = new Date()
        const todayStr = now.toLocaleDateString('en-CA')

        const tomorrow = new Date(now)
        tomorrow.setDate(now.getDate() + 1)
        const tomorrowStr = tomorrow.toLocaleDateString('en-CA')

        // 1. Check local storage if intention already set for tomorrow
        const localIntention = await AsyncStorage.getItem(`suhoor_fasting_intention_${tomorrowStr}`)
        if (localIntention) {
          setHasScheduledToday(true)
          return
        }

        // 2. Check Firestore if dailyFastingStatus doc already exists for tomorrow
        try {
          const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${tomorrowStr}`)
          const statusSnap = await getDoc(statusRef)
          if (statusSnap.exists()) {
            setHasScheduledToday(true)
            return
          }
        } catch (e) {
          console.warn('Could not check remote dailyFastingStatus:', e)
        }

        const storageKey = `fasting_reminder_scheduled_${todayStr}`
        const alreadyScheduled = await AsyncStorage.getItem(storageKey)
        if (alreadyScheduled) {
          setHasScheduledToday(true)
          return
        }

        const scheduledTime = new Date(now)
        scheduledTime.setHours(17, 0, 0, 0) // 5:00 PM

        // If currently before 5:00 PM, schedule for 17:00.
        // If 5:00 PM has already arrived/passed today, schedule for 5 seconds from now so the user receives it!
        const triggerTime = now >= scheduledTime ? new Date(now.getTime() + 5000) : scheduledTime

        const semanticId = `fasting_intention_${todayStr}`
        await scheduleNotification({
          semanticId,
          date: triggerTime,
          title: t('fasting.dailyPromptTitle', 'Time to set your fasting intention'),
          message: t('fasting.dailyPromptMessage', 'Set your intention for tomorrow'),
          channel: CHANNELS.fastingPrompt,
        })

        await AsyncStorage.setItem(storageKey, 'scheduled')
        setHasScheduledToday(true)
        console.log('Fasting intention reminder scheduled for', triggerTime.toISOString())
      } catch (error) {
        console.error('Failed to schedule fasting reminder:', error)
      }
    }

    scheduleFastingReminder()
  }, [currentUser, hasScheduledToday, t])

  return null
}

export default FastingNotificationsManager
