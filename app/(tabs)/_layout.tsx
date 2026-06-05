import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/authStore';
import { useWeddingStore } from '../../store/weddingStore';
import { theme } from '../../constants/theme';

export default function TabLayout() {
  const { role } = useAuthStore();
  const { config } = useWeddingStore();
  const isHost = role === 'host';
  const { bottom } = useSafeAreaInsets();

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
          height: Platform.OS === 'ios' ? 80 : 60 + bottom,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8 + bottom,
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
          tabBarIcon: ({ color, size }) =>
            isHost ? (
              <Ionicons name="shield-outline" size={size} color={color} />
            ) : (
              <Ionicons name="gift-outline" size={size} color={color} />
            ),
        }}
        listeners={
          !isHost && config?.registryUrl
            ? {
                tabPress: (e) => {
                  e.preventDefault();
                  WebBrowser.openBrowserAsync(config.registryUrl!);
                },
              }
            : undefined
        }
      />
    </Tabs>
  );
}
