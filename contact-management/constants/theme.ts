import { Theme, DarkTheme } from '@react-navigation/native';

export const CustomDarkTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: '#1E2875',
    background: '#1E2875',
    card: '#1E2875',
    text: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.1)',
    notification: '#FF4444',
  },
}; 