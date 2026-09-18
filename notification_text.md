# Notification Text Documentation

This file contains all the notification texts sent by the Suhoor app, along with their file locations for easy tuning.

## Notification Categories

### 1. Wake Up Alarms
**File:** `android/app/src/main/java/com/mechseiko/suhoor/alarm/AlarmReceiver.kt` (lines 82-84)
- **Title:** "WAKE UP! ⏰"
- **Message:** "Time for Suhoor! Wake up and verify you are awake."
- **Channel:** Suhoor Alarms (IMPORTANCE_HIGH)

### 2. Remote Buzz Alarms
**File:** `android/app/src/main/java/com/mechseiko/suhoor/alarm/AlarmActivity.kt` (line 118)
- **Title:** "Remote Buzz! 🔔"
- **Message:** (Uses same as wake up alarm)
- **Channel:** Suhoor Alarms

### 3. Re-check Alarms
**File:** `android/app/src/main/java/com/mechseiko/suhoor/alarm/AlarmActivity.kt` (line 117)
- **Title:** "Re-check Alarm ⏰"
- **Message:** (Uses same as wake up alarm)
- **Channel:** Suhoor Alarms

### 4. Audio Mode Warning
**File:** `components/AudioModeWarning.jsx` (lines 62-65)
- **Title:** "⚠️ Audio Mode Warning"
- **Message:** "Your phone may be in silent or DND mode. Alarms may not sound. Please check your audio settings."
- **Channel:** Suhoor Wake Up

### 5. Fasting Intention Notifications
**File:** `services/notifications.js` (lines 21-28)
- **Channels:**
  - `suhoor-wake-up`: "Suhoor Wake Up"
  - `suhoor-fasting-prompt`: "Fasting Intention"
  - `suhoor-start`: "Suhoor Time"
  - `suhoor-end`: "Suhoor Ending"
  - `suhoor-iftar`: "Iftar Time"
  - `suhoor-iftar-reminder`: "Iftar Reminder"

### 6. Toast Notifications (In-App)
**File:** `components/FastingPrompt.jsx`
- **Intention Set Toast:** `t('fasting.intentionSetToast')` - Success tone
- **Save Error Toast:** `t('fasting.saveError')` - Error tone
- **Not Fasting Toast:** `t('fasting.notFastingToast')` - Info tone
- **Save Error No Toast:** `t('fasting.saveErrorNo')` - Error tone

## Notification Icons

All notifications use the app icon:
- **File:** `android/app/src/main/res/drawable/notification_icon`
- **Source:** `assets/icon-nobg.png`

## Important Notes

1. **Priority Levels:** All alarm notifications use `IMPORTANCE_HIGH` to ensure they break through Do Not Disturb mode
2. **Sound:** Alarms use `STREAM_ALARM` audio type for maximum volume
3. **Vibration:** All alarm notifications include vibration patterns
4. **Full-screen Intent:** Wake-up alarms trigger full-screen activity even on lock screen
5. **Image:** All notifications include the app icon next to the text

## Customization

To modify notification texts:
1. Edit the respective files mentioned above
2. For translatable texts, update the translation files in `translations/` directory
3. Test notification appearance after changes
4. Consider character limits for different devices/Android versions