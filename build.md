

cd android

./gradlew bundleRelease

keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab


namespace 'com.mechseiko.suhoor'
defaultConfig {
    applicationId 'com.mechseiko.suhoor'
    minSdkVersion 23
    targetSdkVersion 36
    versionCode 3
    versionName "1.0.2"


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