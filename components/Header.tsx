import React from 'react';
import { Image, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  title: string;
}

const THEME_ICONS: Record<string, any> = {
  light: require('../assets/icon-light-192.png'),
  orange: require('../assets/icon-orange-192.png'),
  velvet: require('../assets/icon-velvet-192.png'),
  dark: require('../assets/icon-dark-192.png'),
};

export default function Header({ title }: HeaderProps) {
  const { theme, currentThemeId } = useTheme();
  const iconSource = THEME_ICONS[currentThemeId] || THEME_ICONS.light;

  return (
    <View
      className="flex-row items-center px-5 pt-12 pb-2 border-b"
      style={{
        backgroundColor: theme.isDark ? theme.colors.surface : '#E2E8F0',
        borderBottomColor: theme.colors.border,
      }}
    >
      {/* Icon with themed background */}
      <View className="mr-3">
        <View
          className="w-10 h-10 rounded-full absolute"
          style={{
            backgroundColor: theme.colors.primary,
            opacity: 0.15,
          }}
        />
        <Image source={iconSource} className="w-10 h-10" resizeMode="contain" />
      </View>

      <Text className="text-2xl font-semibold font-poppins-medium tracking-wider" style={{ color: theme.colors.text }}>
        {title}
      </Text>
    </View>
  );
}
