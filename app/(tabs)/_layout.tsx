import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: {
          backgroundColor: '#1A1A2E',
          borderTopColor: '#2A2A4A',
          paddingBottom: 6,
          height: 58,
        },
        headerStyle: { backgroundColor: '#1A1A2E' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'FocusQuest',
          tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
        }}
      />
      <Tabs.Screen
        name="quests"
        options={{
          title: 'Quests',
          tabBarIcon: ({ color }) => <TabBarIcon name="list-ul" color={color} />,
        }}
      />
      <Tabs.Screen
        name="balance"
        options={{
          title: 'Balance',
          tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} />,
        }}
      />
    </Tabs>
  );
}
