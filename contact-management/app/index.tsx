import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user } = useAuth();

  // Redirect based on auth state
  if (user) {
    return <Redirect href="/(tabs)/home" />;
  }
  
  return <Redirect href="/(auth)/sign-in" />;
} 