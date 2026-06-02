import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🗺</Text>,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>↻</Text>,
        }}
      />
    </Tabs>
  );
}
