import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/auth/LoginScreen";
import SignupScreen from "../screens/auth/SignupScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import OnboardingScreen from "../screens/auth/OnboardingScreen";
import VerifyEmailScreen from "../screens/auth/VerifyEmailScreen";

const Stack = createNativeStackNavigator();
const OnboardingCompleteContext = React.createContext(null);

const OnboardingRoute = () => {
  const onComplete = React.useContext(OnboardingCompleteContext);
  return <OnboardingScreen onComplete={onComplete} />;
};

export const AuthStack = ({ showOnboarding, onCompleteOnboarding, initialRoute }) => {
  return (
    <OnboardingCompleteContext.Provider value={onCompleteOnboarding}>
      <Stack.Navigator
        key={`${showOnboarding ? "onboarding" : "auth"}_${initialRoute || "default"}`}
        initialRouteName={initialRoute || (showOnboarding ? "Onboarding" : "Login")}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      >
        {showOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingRoute} />
        ) : null}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </Stack.Navigator>
    </OnboardingCompleteContext.Provider>
  );
};

export default AuthStack;
