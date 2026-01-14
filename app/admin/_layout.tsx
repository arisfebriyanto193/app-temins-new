import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AWSLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // Warna tema
  const activeColor = '#007AFF';
  const inactiveColor = '#8E8E93';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,

        // 🔥 FIX UTAMA: Safe Area Bottom
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },

        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}
    >
      {/* MENU 1: HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* MENU 2: POWER */}
      <Tabs.Screen
        name="dev"
        options={{
          title: 'device ',
          tabBarLabel: 'Device',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'pulse' : 'pulse-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* MENU 3: HISTORY */}
      <Tabs.Screen
        name="data"
        options={{
          title: 'record',
          tabBarLabel: 'Record',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'list' : 'list-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* MENU 4: AKUN */}
      <Tabs.Screen
        name="info"
        options={{
          title: 'Akun',
          tabBarLabel: 'Akun',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
