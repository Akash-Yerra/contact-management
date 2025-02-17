import { StyleSheet, Dimensions } from 'react-native';
import { View } from 'react-native';

const { width, height } = Dimensions.get('window');

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2875',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  glassContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 30,
    padding: 24,
    width: '100%',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    color: 'white',
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 32,
    textAlign: 'left',
    paddingHorizontal: 8,
  },
  mainContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 25,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    height: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 20,
    color: 'white',
    fontSize: 16,
  },
  button: {
    height: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: 'white',
    fontSize: 16,
    opacity: 0.9,
  },
  linkHighlight: {
    color: 'white',
    fontWeight: '600',
  }
});

export default function AuthStyles() {
  return <View />;
} 