import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { CustomDarkTheme } from '@/constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ContactsProvider } from '@/contexts/ContactsContext';

export default function RootLayout() {
  const { session } = useAuth();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ContactsProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: CustomDarkTheme.colors.background }
              }}
            >
              {session ? (
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              ) : (
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              )}
            </Stack>
          </ContactsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
