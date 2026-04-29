import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../constants/theme';
import { WEDDING } from '../../constants/WEDDING';

export default function TabLayout() {
  const { role } = useAuthStore();
  const isHost = role === 'host';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accentDeep,
        tabBarInactiveTintColor: theme.colors.ink3,
        tabBarStyle: {
          backgroundColor: 'rgba(250,246,241,0.96)',
          borderTopColor: theme.colors.line,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 80 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
          fontFamily: theme.fonts.sans,
        },
      }}>
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="images-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: 'Guests',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: isHost ? 'Admin' : 'Registry',
          href: isHost
            ? '/(tabs)/manage'
            : undefined,
          tabBarIcon: ({ color, size }) =>
            isHost ? (
              <Ionicons name="shield-outline" size={size} color={color} />
            ) : (
              <Ionicons name="gift-outline" size={size} color={color} />
            ),
        }}
        listeners={
          !isHost
            ? {
                tabPress: (e) => {
                  e.preventDefault();
                  WebBrowser.openBrowserAsync(WEDDING.registryUrl);
                },
              }
            : undefined
        }
      />
    </Tabs>
  );
}
