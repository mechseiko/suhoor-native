import React from 'react'
import { TouchableOpacity } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LearnScreen from '../screens/learn/LearnScreen'
import DuasScreen from '../screens/duas/DuasScreen'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { font, size, weight } from '../theme'

const Stack = createNativeStackNavigator()

export const LearnStack = () => {
  const { colors } = useTheme()
  const { t } = useLanguage()

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          ...font('heading', weight.bold),
          fontSize: size.xl,
          color: colors.text,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      })}
    >
      <Stack.Screen
        name="LearnHome"
        component={LearnScreen}
        options={{
          title: t('learn.title', 'Learn'),
          headerTitle: t('learn.title', 'Learn'),
        }}
      />
      <Stack.Screen
        name="Duas"
        component={DuasScreen}
        options={({ navigation }) => ({
          title: t('learn.topic.fastingDuas', 'Fasting Supplications'),
          headerTitle: t('learn.topic.fastingDuas', 'Fasting Supplications'),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginRight: 12, padding: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  )
}

export default LearnStack
