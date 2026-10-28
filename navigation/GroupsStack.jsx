import React from 'react';
import { TouchableOpacity, View, Image } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GroupsScreen from '../screens/groups/GroupsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupSettingsScreen from '../screens/groups/GroupSettingsScreen';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { font, size, weight } from '../theme';
import { Text } from '../components/ui';

const Stack = createNativeStackNavigator();

export const GroupsStack = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();

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
        headerLeft: () =>
          navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginRight: 4, padding: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ) : null,
        contentStyle: { backgroundColor: colors.background },
      })}
    >
      <Stack.Screen
        name="GroupsList"
        component={GroupsScreen}
        options={{
          title: t('nav.groups', 'Groups'),
          headerTitle: t('nav.groups', 'Groups'),
        }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={({ route, navigation }) => ({
          headerTitle: () => {
            const groupName = route?.params?.groupName || t('groups.detail', 'Group Details');
            const groupPicture = route?.params?.groupPicture;
            
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {groupPicture ? (
                  <Image
                    source={{ uri: groupPicture }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                  />
                ) : (
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Ionicons name="people" size={18} color={colors.primary} />
                  </View>
                )}
                <Text style={{ fontSize: size.lg, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {groupName}
                </Text>
              </View>
            );
          },
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => {
                navigation.navigate('GroupSettings', {
                  groupId: route.params.groupId,
                  groupName: route.params.groupName,
                });
              }} 
              hitSlop={10}
            >
              <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default GroupsStack;