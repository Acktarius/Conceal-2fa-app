import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface FundingBannerProps {
  balance: number;
  maxKeys: number;
  onPress: () => void;
}

export default function FundingBanner({ balance, maxKeys, onPress }: FundingBannerProps) {
  const [currentText, setCurrentText] = useState(0);
  const [showBanner, setShowBanner] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);
  const fadeAnim = new Animated.Value(1);
  const { theme } = useTheme();

  const messages = [
    balance === 0 
      ? "Balance: 0 CCX - your keys won't be saved until you top up your wallet"
      : `Insufficient funds - your keys won't be saved until you top up your wallet`,
    "Send some CCX to this address to unlock blockchain storage and sharing features"
  ];

  useEffect(() => {
    if (balance >= 0.0001) {
      setShowBanner(false);
      return;
    }

    const interval = setInterval(() => {
      setCurrentText(prev => {
        const next = (prev + 1) % messages.length;
        if (next === 0) {
          setCycleCount(count => {
            const newCount = count + 1;
            if (newCount >= 2) {
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }).start(() => {
                setShowBanner(false);
              });
            }
            return newCount;
          });
        }
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [balance]);

  if (!showBanner || balance >= 0.0001) {
    return null;
  }

  const styles = createStyles(theme);

  return (
    <Animated.View style={[styles.banner, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.bannerContent}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="wallet-outline" size={20} color={theme.colors.warning} />
        </View>
        <Text style={styles.bannerText} numberOfLines={2}>
          {messages[currentText]}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.warning} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  banner: {
    backgroundColor: theme.isDark ? 'rgba(251, 191, 36, 0.1)' : '#FEF3C7',
    borderRadius: 12,
    margin: 16,
    marginBottom: 8,
    shadowColor: theme.colors.warning,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(251, 191, 36, 0.2)' : '#FDE68A',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.warning,
    fontWeight: '500',
    lineHeight: 18,
  },
});