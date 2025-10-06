import React from 'react';
import { View, Text, Image } from 'react-native';
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
      <Image
        source={{ uri: 'https://wallet.conceal.network/assets/img/icons/icon-402x402.png' }}
        className="w-10 h-10 mr-3"
        resizeMode="contain"
      />
      <Text 
        className="text-2xl font-semibold font-poppins-medium tracking-wider"
        style={{ color: theme.colors.text }}
      >
        {title}
      </Text>
    </View>
  );
}