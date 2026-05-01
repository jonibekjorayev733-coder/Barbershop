import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text } from 'react-native';

function TabIcon({ label, size }: { label: string; size: number }) {
  return <Text style={{ fontSize: size - 4 }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#eee',
          elevation: 8,
          height: Platform.OS === 'ios' ? 80 : 60,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Sartaroshlar',
          tabBarIcon: ({ size }) => <TabIcon label="✂️" size={size} />,
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          title: 'Bron',
          tabBarIcon: ({ size }) => <TabIcon label="📅" size={size} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ size }) => <TabIcon label="👤" size={size} />,
        }}
      />
    </Tabs>
  );
}
