import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InstansiLayout() {
  const insets = useSafeAreaInsets();
  const activeColor = '#3b82f6';
  const inactiveColor = '#9ca3af';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          height: 62 + (insets.bottom > 0 ? insets.bottom : 6),
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wind-rose"
        options={{
          title: 'Wind Rose',
          tabBarLabel: 'Wind Rose',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'analytics' : 'analytics-outline'} size={23} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="forecast"
        options={{ href: null,
          title: 'Cuaca',
         }}
      />
      {/* <Tabs.Screen
        name="forecast"
        options={{
          title: 'Cuaca',
          tabBarLabel: 'Cuaca',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'partly-sunny' : 'partly-sunny-outline'} size={23} color={color} />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Riwayat',
          tabBarLabel: 'Riwayat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="power"
        options={{
          title: 'Power',
          tabBarLabel: 'Power',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: 'Akun',
          tabBarLabel: 'Akun',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
