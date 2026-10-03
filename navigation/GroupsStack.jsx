import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CLOSED_TESTER_FEATURES } from '../config/closedTesterFeatures';
import GroupsComingSoonScreen from '../screens/groups/GroupsComingSoonScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupSettingsScreen from '../screens/groups/GroupSettingsScreen';
import Colors from '../constants/Colors';

const Stack = createNativeStackNavigator();

export const GroupsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen
        name="GroupsList"
        component={CLOSED_TESTER_FEATURES.groups ? GroupsScreen : GroupsComingSoonScreen}
        options={{
          title: 'My Groups',
          headerShown: CLOSED_TESTER_FEATURES.groups,
        }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{ title: 'Group Settings' }}
      />
    </Stack.Navigator>
  );
};

export default GroupsStack;
