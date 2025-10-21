import React from 'react';
import { Image, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { theme } = useTheme();

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
        <Image source={require('../assets/icon-192.png')} className="w-10 h-10" resizeMode="contain" />
      </View>

      <Text className="text-2xl font-semibold font-poppins-medium tracking-wider" style={{ color: theme.colors.text }}>
        {title}
      </Text>
    </View>
  );
}
