import { Stack } from 'expo-router';

export default function ContactLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1E2875' }
      }}
    >
      <Stack.Screen 
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="new"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
} 