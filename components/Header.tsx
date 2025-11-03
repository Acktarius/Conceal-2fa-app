import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  title: string;
  onTitleDoubleTap?: () => void;
}

const THEME_ICONS: Record<string, any> = {
  light: require('../assets/icon-light-192.png'),
  orange: require('../assets/icon-orange-192.png'),
  velvet: require('../assets/icon-velvet-192.png'),
  dark: require('../assets/icon-dark-192.png'),
};

export default function Header({ title, onTitleDoubleTap }: HeaderProps) {
  const { theme, currentThemeId } = useTheme();
  const iconSource = THEME_ICONS[currentThemeId] || THEME_ICONS.light;

  // Double tap detection
  const lastTapRef = React.useRef<number>(0);
  const DOUBLE_TAP_DELAY = 300;

  const handleTitlePress = () => {
    if (!onTitleDoubleTap) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      onTitleDoubleTap();
      lastTapRef.current = 0; // Reset to prevent triple-tap
    } else {
      lastTapRef.current = now;
    }
  };

  const TitleComponent = onTitleDoubleTap ? (
    <TouchableOpacity onPress={handleTitlePress} activeOpacity={1}>
      <Text className="text-2xl font-semibold font-poppins-medium tracking-wider" style={{ color: theme.colors.text }}>
        {title}
      </Text>
    </TouchableOpacity>
  ) : (
    <Text className="text-2xl font-semibold font-poppins-medium tracking-wider" style={{ color: theme.colors.text }}>
      {title}
    </Text>
  );

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

      {TitleComponent}
    </View>
  );
}
