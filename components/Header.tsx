import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.isDark ? theme.colors.surface : '#E2E8F0',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    logo: {
      width: 32,
      height: 32,
      marginRight: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
    },
  });

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://wallet.conceal.network/assets/img/icons/icon-402x402.png' }}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}