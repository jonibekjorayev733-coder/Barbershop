import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { userDesign } from '@/constants/user-design';

const accent = userDesign.accentStrong;

function TabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconContainer, focused && styles.activeIconBg]}>
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: userDesign.textMuted,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopWidth: 0.5,
          borderTopColor: userDesign.line,
          height: Platform.OS === 'ios' ? 92 : 82,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 8,
          position: 'absolute',
          elevation: 0,
          ...(Platform.OS === 'web'
            ? { boxShadow: '0px -12px 24px rgba(17, 24, 39, 0.08)' }
            : {
                shadowColor: '#111827',
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.06,
                shadowRadius: 20,
              }),
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2, paddingBottom: 2, letterSpacing: -0.1 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Sartaroshlar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "cut" : "cut-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mybookings"
        options={{
          title: 'Bronlarim',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "list" : "list-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 46,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  activeIconBg: {
    backgroundColor: userDesign.accentSoft,
    borderWidth: 0.5,
    borderColor: userDesign.line,
  }
});