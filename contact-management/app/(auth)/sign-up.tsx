import { useState, useEffect } from 'react';
import { TextInput, TouchableOpacity, Image, View, Text, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authStyles } from './styles';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signUp } = useAuth();
  const navigation = useNavigation();

  // Clear fields when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setEmail('');
      setPassword('');
    });

    return unsubscribe;
  }, [navigation]);

  const handleSignUp = async () => {
    // Form validation
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      await signUp(email.trim(), password);
    } catch (error) {
      // Don't show technical error details to user
      console.error('Sign up error:', error);
    }
  };

  return (
    <View style={authStyles.container}>
      <LinearGradient
        colors={['#1E2875', '#1E2875']}
        style={authStyles.gradientBackground}
      />
      <View style={authStyles.formContainer}>
        <View style={authStyles.glassContainer}>
          <View style={authStyles.logoContainer}>
            <Image 
              source={require('@/assets/images/logo.jpg')}
              style={authStyles.logo}
              resizeMode="cover"
            />
          </View>
          
          <Text style={authStyles.title}>Create Account</Text>
          
          <View style={authStyles.mainContainer}>
            <View style={authStyles.inputContainer}>
              <TextInput
                style={authStyles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            
            <View style={authStyles.inputContainer}>
              <TextInput
                style={authStyles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity 
              style={authStyles.button}
              onPress={handleSignUp}
              activeOpacity={0.9}
            >
              <Text style={authStyles.buttonText}>Sign Up</Text>
            </TouchableOpacity>

            <Link href="/(auth)/sign-in" asChild style={authStyles.link}>
              <TouchableOpacity>
                <Text style={authStyles.linkText}>
                  Have an account? Sign In
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
} 