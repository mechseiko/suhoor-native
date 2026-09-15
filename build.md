

cd android

./gradlew bundleRelease

keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab

.aab file | android/app/build/outputs/bundle/release/app-release.aab
mapping.txt file | android/app/build/outputs/mapping/mapping.txt


~~android/app - build.gradle 

namespace 'com.mechseiko.suhoor'
defaultConfig {
    applicationId 'com.mechseiko.suhoor'
    minSdkVersion 23
    targetSdkVersion 36
    versionCode 4
    versionName "1.0.3"


~~android - build.gradle 

buildscript {
  ext {
    buildToolsVersion = "34.0.0"
    minSdkVersion = 23
    compileSdkVersion = 36
    targetSdkVersion = 36
    ndkVersion = "25.1.8937393"
    kotlinVersion = "1.9.0"
  }
  repositories {





<!-- FOREGROUND_SERVICE_SPECIAL_USE

    The foreground service is used to ensure reliable alarm notifications for the Suhoor The foreground service is used to ensure reliable alarm notifications for the Suhoor app. When a user schedules an alarm, the service runs in the background with a persistent notification to guarantee the alarm triggers at the exact scheduled time, even if the app is not actively running or the device is in Doze mode.


The alarm foreground service must start immediately when an alarm is scheduled because:

1. Time-critical functionality: Suhoor (pre-dawn meal) alarms have specific religious and practical time requirements that cannot be delayed or missed.

2. System restrictions: Android's battery optimization and Doze mode can kill background processes, which would prevent alarms from triggering

3. No interruption tolerance: The alarm must trigger at the exact scheduled time - pausing or restarting the service could cause users to miss their pre-dawn meal

4. Persistent notification: The service displays a visible notification "Suhoor Alarm Active" so users are aware the alarm is scheduled and running

The service shows a high-priority notification with the alarm time and allows users to return to the app. It only runs when an alarm is actively scheduled and stops immediately when the alarm is dismissed or cancelled. -->

