import React from 'react'
import { Platform, TouchableOpacity, View } from 'react-native'
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/home/HomeScreen'
import GroupsStack from './GroupsStack'
import ProfileScreen from '../screens/profile/ProfileScreen'
import FastingTimesScreen from '../screens/fasting/FastingTimesScreen'
import DuasScreen from '../screens/duas/DuasScreen'
import LeaderboardScreen from '../screens/leaderboard/LeaderboardScreen'
import MilestonesScreen from '../screens/milestones/MilestonesScreen'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { font, size, weight } from '../theme'

// Only import safe area context on mobile platforms
let useSafeAreaInsets
if (Platform.OS !== 'web') {
  try {
    useSafeAreaInsets = require('react-native-safe-area-context').useSafeAreaInsets
  } catch (e) {
    console.warn('react-native-safe-area-context not available')
  }
}

const Tab = createBottomTabNavigator()

export const TabNavigator = ({ tabBarRef }) => {
  const { colors } = useTheme()
  const { t } = useLanguage()
  // Only use safe area insets on mobile (not web) to avoid SafeAreaProvider requirement
  const insets = Platform.OS === 'web' ? { top: 0 } : (useSafeAreaInsets ? useSafeAreaInsets() : { top: 0 })

  return (
    <Tab.Navigator
      tabBar={
        tabBarRef
          ? (props) => (
              <View collapsable={false} ref={tabBarRef}>
                <BottomTabBar {...props} />
              </View>
            )
          : undefined
      }
      screenOptions={({ route, navigation }) => ({
        // Show back button if there is a back stack available
        headerLeft: () =>
          navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginLeft: 16, padding: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ) : null,
        tabBarIcon: ({ focused, color, size: iconSize }) => {
          const NAMES = {
            HomeTab: 'home',
            FastingTimesTab: 'alarm',
            GroupsTab: 'people',
            DuasTab: 'book',
            ProfileTab: 'person',
          }
          const base = NAMES[route.name] ?? 'ellipse'
          return (
            <Ionicons
              name={focused ? base : `${base}-outline`}
              size={iconSize}
              color={color}
            />
          )
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: Platform.OS === 'web' ? 8 : 6,
          paddingTop: Platform.OS === 'web' ? 8 : 6,
          height: Platform.OS === 'web' ? 70 : 62,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          ...font('heading', weight.bold),
          fontSize: size.xl,
          color: colors.text,
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Overview',
          tabBarLabel: 'Overview',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="FastingTimesTab"
        component={FastingTimesScreen}
        options={{
          title: 'Alarms',
          tabBarLabel: 'Alarms',
          headerTitle: t('nav.fastingTimes'),
        }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStack}
        options={{
          title: 'Groups',
          tabBarLabel: 'Groups',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="DuasTab"
        component={DuasScreen}
        options={{
          title: 'Duas',
          tabBarLabel: 'Duas',
          headerTitle: t('duas.title'),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          headerTitle: t('profile.myProfile'),
        }}
      />
      <Tab.Screen
        name="LeaderboardTab"
        component={LeaderboardScreen}
        options={{
          title: 'Leaderboard',
          headerTitle: t('nav.leaderboard'),
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="MilestonesTab"
        component={MilestonesScreen}
        options={{
          title: 'Milestones',
          headerTitle: t('nav.milestones'),
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  )
}

export default TabNavigator