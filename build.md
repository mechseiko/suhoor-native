

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