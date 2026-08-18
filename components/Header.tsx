import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  title: string;
  onTitleDoubleTap?: () => void;
  searchEnabled?: boolean;
  searchOpen?: boolean;
  searchQuery?: string;
  onSearchOpen?: () => void;
  onSearchQueryChange?: (query: string) => void;
  onSearchClose?: () => void;
}

const THEME_ICONS: Record<string, any> = {
  light: require('../assets/icon-light-192.png'),
  orange: require('../assets/icon-orange-192.png'),
  velvet: require('../assets/icon-velvet-192.png'),
  dark: require('../assets/icon-dark-192.png'),
};

const SEARCH_INPUT_WIDTH = 160;

export default function Header({
  title,
  onTitleDoubleTap,
  searchEnabled = false,
  searchOpen = false,
  searchQuery = '',
  onSearchOpen,
  onSearchQueryChange,
  onSearchClose,
}: HeaderProps) {
  const { theme, currentThemeId } = useTheme();
  const iconSource = THEME_ICONS[currentThemeId] || THEME_ICONS.light;

  const lastTapRef = React.useRef<number>(0);
  const DOUBLE_TAP_DELAY = 300;

  const handleTitlePress = () => {
    if (!onTitleDoubleTap) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      onTitleDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const titleText = (
    <Text
      className="text-2xl font-semibold font-poppins-medium tracking-wider"
      style={{ color: theme.colors.text }}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {title}
    </Text>
  );

  const TitleComponent = onTitleDoubleTap ? (
    <TouchableOpacity onPress={handleTitlePress} activeOpacity={1} className="flex-1 min-w-0 mr-2" style={{ flexShrink: 1 }}>
      {titleText}
    </TouchableOpacity>
  ) : (
    <View className="flex-1 min-w-0 mr-2" style={{ flexShrink: 1 }}>
      {titleText}
    </View>
  );

  return (
    <View
      className="flex-row items-center px-5 pt-12 pb-2 border-b"
      style={{
        backgroundColor: theme.isDark ? theme.colors.surface : '#E2E8F0',
        borderBottomColor: theme.colors.border,
      }}
    >
      <Image source={iconSource} className="w-10 h-10 mr-3" style={{ flexShrink: 0 }} resizeMode="contain" />

      {TitleComponent}

      {searchEnabled ? (
        <View className="flex-row items-center" style={{ flexShrink: 0 }}>
          {searchOpen ? (
            <>
              <TextInput
                className="h-9 px-3 rounded-lg mr-2 text-sm"
                style={{
                  width: SEARCH_INPUT_WIDTH,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                }}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                placeholder="Filter by provider"
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel="Filter by provider"
              />
              <TouchableOpacity
                onPress={onSearchClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={onSearchOpen}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Search providers"
            >
              <Ionicons name="search" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}
