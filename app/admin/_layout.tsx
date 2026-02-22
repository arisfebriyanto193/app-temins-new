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
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dev"
        options={{
          title: 'Device',
          tabBarLabel: 'Device',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={22} color={color} />
          ),
        }}
      />
      {/* <Tabs.Screen
        name="data"
        options={{
          title: 'Data',
          tabBarLabel: 'Data',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'server' : 'server-outline'} size={22} color={color} />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="instansi"
        options={{
          title: 'Instansi',
          tabBarLabel: 'Instansi',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'business' : 'business-outline'} size={22} color={color} />
          ),
        }}
      />
      {/* <Tabs.Screen
        name="mqtt"
        options={{
          title: 'MQTT',
          tabBarLabel: 'MQTT',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'radio' : 'radio-outline'} size={22} color={color} />
          ),
        }}
      /> */}
      {/* <Tabs.Screen
        name="rec"
        options={{
          title: 'Rec',
          tabBarLabel: 'Rec',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'recording' : 'recording-outline'} size={22} color={color} />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="info"
        options={{
          title: 'Akun',
          tabBarLabel: 'Akun',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
