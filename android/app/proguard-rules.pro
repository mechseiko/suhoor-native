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

# React Native bridge reflection
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
   public <init>(...);
   @com.facebook.react.bridge.ReactMethod *;
}
-keep class com.facebook.react.bridge.NativeModule { *; }
-keep class com.facebook.react.bridge.JavaScriptModule { *; }
