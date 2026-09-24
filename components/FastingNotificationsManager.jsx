import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useFastingTimes } from '../hooks/useFastingTimes'
import { scheduleNotification, CHANNELS } from '../services/notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Headless manager component for fasting notifications.
 * Schedules daily 5PM fasting intention reminders for users who haven't set their intention.
 */
export const FastingNotificationsManager = () => {
  const { currentUser } = useAuth()
  const { todayData } = useFastingTimes()
  const [hasScheduledToday, setHasScheduledToday] = useState(false)

  useEffect(() => {
    if (!currentUser || Platform.OS === 'web' || hasScheduledToday) return

    const scheduleFastingReminder = async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')
        const storageKey = `fasting_reminder_scheduled_${today}`
        const alreadyScheduled = await AsyncStorage.getItem(storageKey)
        
        if (alreadyScheduled) {
          setHasScheduledToday(true)
          return
        }

        // Schedule notification for 5PM today
        const reminderTime = new Date()
        reminderTime.setHours(17, 0, 0, 0) // 5:00 PM

        // If 5PM has already passed today, skip
        if (reminderTime <= new Date()) {
          await AsyncStorage.setItem(storageKey, 'skipped')
          setHasScheduledToday(true)
          return
        }

        const semanticId = `fasting_intention_${today}`
        await scheduleNotification({
          semanticId,
          date: reminderTime,
          title: 'Time to Set Your Fasting Intention',
          message: 'Don\'t forget to set your fasting intention for tomorrow!',
          channel: CHANNELS.fastingPrompt,
        })

        await AsyncStorage.setItem(storageKey, 'scheduled')
        setHasScheduledToday(true)
        console.log('Fasting intention reminder scheduled for 5PM')
      } catch (error) {
        console.error('Failed to schedule fasting reminder:', error)
      }
    }

    scheduleFastingReminder()
  }, [currentUser, hasScheduledToday])

  return null
}

export default FastingNotificationsManager
