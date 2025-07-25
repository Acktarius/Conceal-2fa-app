import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StorageService } from '../services/StorageService';

export interface Theme {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    primaryLight: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    border: string;
    tabBar: string;
    tabBarActive: string;
    tabBarInactive: string;
    switchTrack: string;
    switchThumb: string;
  };
}

const lightTheme: Theme = {
  isDark: false,
  colors: {
    background: '#F1F5F9',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#475569',
    primary: '#3B82F6',
    primaryLight: '#EFF6FF',
    accent: '#06B6D4',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#E2E8F0',
    tabBar: '#FFFFFF',
    tabBarActive: '#3B82F6',
    tabBarInactive: '#475569',
    switchTrackTrue: '#3B82F6', // Blue when ON
    switchTrackFalse: '#CBD5E1', // Light grey when OFF
    switchThumbColor: '#F8FAFC', // Light color
  },
};

const darkTheme: Theme = {
  isDark: true,
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    card: '#334155',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    primary: '#60A5FA',
    primaryLight: '#1E293B',
    accent: '#22D3EE',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#475569',
    tabBar: '#1E293B',
    tabBarActive: '#FFA500',
    tabBarInactive: '#94A3B8',
    switchTrackTrue: '#FFA500', // Orange when ON
    switchTrackFalse: '#475569', // Grey when OFF
    switchThumbColor: '#0F172A', // Same as background
  },
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const settings = await StorageService.getSettings();
      if (settings.darkMode !== undefined) {
        setIsDark(settings.darkMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    try {
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({ ...settings, darkMode: newIsDark });
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}