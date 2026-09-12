import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginScreen from '../screens/auth/LoginScreen'
import SignupScreen from '../screens/auth/SignupScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import OnboardingScreen from '../screens/auth/OnboardingScreen'

const Stack = createNativeStackNavigator()

export const AuthStack = ({ showOnboarding, onCompleteOnboarding }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      {showOnboarding ? (
        <Stack.Screen name="Onboarding">
          {() => <OnboardingScreen onComplete={onCompleteOnboarding} />}
        </Stack.Screen>
      ) : null}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  )
}

export default AuthStack
