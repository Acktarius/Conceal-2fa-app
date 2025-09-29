import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StorageService } from '../services/StorageService';

export interface Theme {
  isDark: boolean;
  themeId: string; // Add theme identifier
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
    switchTrackTrue: string;
    switchTrackFalse: string;
    switchThumbColor: string;
  };
}

const lightTheme: Theme = {
  isDark: false,
  themeId: 'light',
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
    switchTrack: '#CBD5E1',
    switchThumb: '#F8FAFC',
    switchTrackTrue: '#3B82F6', // Blue when ON
    switchTrackFalse: '#CBD5E1', // Light grey when OFF
    switchThumbColor: '#F8FAFC', // Light color
  },
};

const darkTheme: Theme = {
  isDark: true,
  themeId: 'dark',
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
    switchTrack: '#475569',
    switchThumb: '#0F172A',
    switchTrackTrue: '#FFA500', // Orange when ON
    switchTrackFalse: '#475569', // Grey when OFF
    switchThumbColor: '#0F172A', // Same as background
  },
};

const orangeTheme: Theme = {
  isDark: true,
  themeId: 'orange',
  colors: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    card: '#262626',
    text: '#FF8C00',
    textSecondary: '#FFA500',
    primary: '#FF8C00',
    primaryLight: '#262626',
    accent: '#FF6B35',
    success: '#00FF7F',
    warning: '#FFD700',
    error: '#FF4444',
    border: '#333333',
    tabBar: '#1A1A1A',
    tabBarActive: '#FF8C00',
    tabBarInactive: '#FFA500',
    switchTrack: '#333333',
    switchThumb: '#0D0D0D',
    switchTrackTrue: '#FF8C00',
    switchTrackFalse: '#333333',
    switchThumbColor: '#0D0D0D',
  },
};

const velvetTheme: Theme = {
  isDark: true,
  themeId: 'velvet',
  colors: {
    background: '#4A5875',
    surface: '#1A0F1A',
    card: '#162D46',
    text: '#E6D7FF',
    textSecondary: '#C4A8E8',
    primary: '#8852d2',
    primaryLight: '#2A1F2A',
    accent: '#B380E6',
    success: '#98FB98',
    warning: '#FFB6C1',
    error: '#FF69B4',
    border: '#3A3A3A',
    tabBar: '#1A0F1A',
    tabBarActive: '#3B82F6',
    tabBarInactive: '#C4A8E8',
    switchTrack: '#3A3A3A',
    switchThumb: '#0F0A0F',
    switchTrackTrue: '#8852d2',
    switchTrackFalse: '#3A3A3A',
    switchThumbColor: '#0F0A0F',
  },
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (themeId: string) => void;
  isDark: boolean;
  currentThemeId: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [currentThemeId, setCurrentThemeId] = useState('dark'); // Default to dark mode

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const settings = await StorageService.getSettings();
      if (settings.themeId) {
        setCurrentThemeId(settings.themeId);
      } else if (settings.darkMode !== undefined) {
        // Migrate from old darkMode setting
        setCurrentThemeId(settings.darkMode ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newThemeId = currentThemeId === 'light' ? 'dark' : 'light';
    setCurrentThemeId(newThemeId);
    
    try {
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({ ...settings, themeId: newThemeId });
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const setTheme = async (themeId: string) => {
    setCurrentThemeId(themeId);
    
    try {
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({ ...settings, themeId });
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const getTheme = (themeId: string): Theme => {
    switch (themeId) {
      case 'light': return lightTheme;
      case 'dark': return darkTheme;
      case 'orange': return orangeTheme;
      case 'velvet': return velvetTheme;
      default: return darkTheme;
    }
  };

  const theme = getTheme(currentThemeId);
  const isDark = theme.isDark;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark, currentThemeId }}>
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