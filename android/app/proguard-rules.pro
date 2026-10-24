# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Alarm module and Gson serialization
-keep class com.mechseiko.suhoor.alarm.** { *; }
-keepclassmembers class com.mechseiko.suhoor.alarm.** { *; }
-keep class com.google.code.gson.** { *; }
-keepclassmembers class com.google.code.gson.** { *; }

# Facebook image pipeline (fbjni/imagepipeline in react-native deps) references
# androidx exif utils that are not packaged; harmless, silence R8's missing-class
# error generated in _app/outputs/mapping/release/missing_rules.txt.
-dontwarn androidx.exifinterface.media.ExifInterface

# Hermes JS Engine
-keep class com.facebook.hermes.reactexecutor.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native bridge reflection
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
   public <init>(...);
   @com.facebook.react.bridge.ReactMethod *;
}
-keep class com.facebook.react.bridge.NativeModule { *; }
-keep class com.facebook.react.bridge.JavaScriptModule { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.modules.** { *; }
-keep class com.facebook.react.modules.blob.** { *; }
-keepclassmembers class com.facebook.react.modules.blob.** { *; }
-keep class com.facebook.react.modules.blob.BlobCollector { *; }
-keepclassmembers class com.facebook.react.modules.blob.BlobCollector { *; }
-keep class com.facebook.react.modules.blob.BlobModule { *; }
-keepclassmembers class com.facebook.react.modules.blob.BlobModule { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keepclasseswithmembernames class * {
    native <methods>;
}

# SoLoader — React Native's native-module loader. Without this keep, a
# minified release build throws ExceptionInInitializerError from BlobModule's
# static initializer (SoLoader.n -> native loader) at startup, which surfaces
# as "main has not been registered" and crashes the app immediately.
-keep class com.facebook.soloader.** { *; }
-keepclassmembers class com.facebook.soloader.** { *; }
-dontwarn com.facebook.soloader.**

# Expo / Unimodules autolinked modules — keep package + module implementations
# so R8 doesn't strip them or their static initializers in release builds.
-keep class expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }
-keep class org.unimodules.** { *; }
-keepclassmembers class org.unimodules.** { *; }
-dontwarn expo.modules.**
-dontwarn org.unimodules.**

# react-native-sound — replaces expo-av for alarm + audio preview
-keep class com.zmxv.RNSound.** { *; }
-keepclassmembers class com.zmxv.RNSound.** { *; }

# react-native-vector-icons — replaces @expo/vector-icons
-keep class com.oblador.vectoricons.** { *; }
-keepclassmembers class com.oblador.vectoricons.** { *; }
