import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AWLRLayout() {
  const insets = useSafeAreaInsets();

  const activeColor = '#007AFF';
  const inactiveColor = '#8E8E93';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
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
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* MENU 3: HISTORY */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Riwayat',
          tabBarLabel: 'Riwayat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* MENU 4: POWER */}
      <Tabs.Screen
        name="power"
        options={{
          title: 'Power',
          tabBarLabel: 'Power',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* MENU 5: AKUN */}
      <Tabs.Screen
        name="info"
        options={{
          title: 'Akun',
          tabBarLabel: 'Akun',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="forecast"
        options={{ href: null,
          title: 'Cuaca',
         }}
      />
      {/* HIDDEN: Forecast - terdaftar tapi tidak tampil di tab bar */}

    </Tabs>
  );
}

