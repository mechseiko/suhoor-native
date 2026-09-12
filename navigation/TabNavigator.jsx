import React from 'react'
import { Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/home/HomeScreen'
import GroupsStack from './GroupsStack'
import ProfileScreen from '../screens/profile/ProfileScreen'
import FastingTimesScreen from '../screens/fasting/FastingTimesScreen'
import DuasScreen from '../screens/duas/DuasScreen'
import LeaderboardScreen from '../screens/leaderboard/LeaderboardScreen'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { font, size, weight } from '../theme'

const Tab = createBottomTabNavigator()

/**
 * Chrome styling follows the web `DashboardLayout`, whose mobile top bar is
 * `bg-white border-b border-gray-100` with a `text-xl font-bold text-gray-900`
 * page title — a light bar, not a filled brand-colour one. The tab bar is the
 * phone stand-in for the web sidebar, so it borrows the sidebar's active
 * treatment: brand colour for the current item, `text-gray-600` for the rest.
 */
export const TabNavigator = () => {
  const { colors } = useTheme()
  const { t } = useLanguage()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size: iconSize }) => {
          const NAMES = {
            HomeTab: 'home',
            FastingTimesTab: 'globe',
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
      {/*
        Registered here so `navigation.navigate('LeaderboardTab')` from the
        profile sidebar resolves, but kept out of the tab bar itself: five tabs
        is already the comfortable maximum on a phone, and the sidebar is the
        only entry point. `tabBarItemStyle: display none` collapses the slot —
        the bar lays items out with flex, so without it the four visible tabs
        would leave a gap where this one sits.
      */}
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
    </Tab.Navigator>
  )
}

export default TabNavigator
