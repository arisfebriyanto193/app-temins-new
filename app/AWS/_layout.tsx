import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AWSLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  
  const activeColor = '#007AFF'; 
  const inactiveColor = '#8E8E93';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 5, // Tambahkan insets.bottom
          height: 60 + (insets.bottom > 0 ? insets.bottom : 5), // Tinggi tab bar disesuaikan
        },
        headerShown: true,
      }}
    >
      {/* MENU 1: DASHBOARD */}
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: '',
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

      {/* MENU 2: MONITORING */}
      

      {/* MENU 3: HISTORY */}
      <Tabs.Screen
        name="history"
        options={{
          headerShown: false,
          title: 'Riwayat Data',
          tabBarLabel: 'Riwayat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'list' : 'list-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />

      <Tabs.Screen
        name="power"
        options={{
          headerShown: false,
          title: 'Live Monitor',
          tabBarLabel: 'Power',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'pulse' : 'pulse-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
 
      {/* MENU 4: SETTINGS */}
      <Tabs.Screen
        name="info"
        options={{
          headerShown: false,
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