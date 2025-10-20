import { Ionicons } from '@expo/vector-icons';
import type React from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface ToggleOption {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface ExpSectionToggleProps {
  sectionTitle: string; // Section title (e.g., "Appearance")
  title: string; // Main text in the tile (e.g., "Theme")
  subtitle?: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleSwitch: (value: boolean) => void;
  onOptionSelect: (optionId: string) => void;
  options: ToggleOption[];
  selectedOptionId: string;
  leftOptionId: string;
  rightOptionId: string;
  children?: React.ReactNode;
  className?: string;
}

export const ExpSectionToggle: React.FC<ExpSectionToggleProps> = ({
  sectionTitle,
  title,
  subtitle,
  icon,
  isExpanded,
  onToggle,
  onToggleSwitch,
  onOptionSelect,
  options,
  selectedOptionId,
  leftOptionId,
  rightOptionId,
  children,
  className = 'mb-6',
}) => {
  const { theme } = useTheme();

  // Determine toggle switch state
  const getToggleValue = (): boolean => {
    if (selectedOptionId === leftOptionId) return false;
    if (selectedOptionId === rightOptionId) return true;
    // For any other option (like 5s, 10s in 2FA Display), show as ON to display the colored track
    return true;
  };

  // Handle toggle switch change
  const handleToggleSwitch = (value: boolean) => {
    const targetOptionId = value ? rightOptionId : leftOptionId;
    onOptionSelect(targetOptionId);
    onToggleSwitch(value);
  };

  // Handle option selection
  const handleOptionSelect = (optionId: string) => {
    onOptionSelect(optionId);
    // Collapse section after selection
    if (isExpanded) {
      onToggle();
    }
  };

  const toggleValue = getToggleValue();
  const hasMoreThanTwoOptions = options.length > 2;

  // Get track color based on selected theme
  const getTrackColor = () => {
    if (selectedOptionId === 'orange') return '#FF8C00';
    if (selectedOptionId === 'velvet') return '#8852d2';
    if (selectedOptionId === 'dark') return theme.colors.primary;
    if (selectedOptionId === 'light') return theme.colors.border;

    // For 2FA Display options, use blue when not "off"
    if (selectedOptionId === 'off') return theme.colors.border;
    if (selectedOptionId === '5s' || selectedOptionId === '10s' || selectedOptionId === 'on') {
      return theme.colors.primary;
    }

    return theme.colors.border; // Default
  };

  return (
    <View className={className}>
      <Text className="text-base font-semibold mb-2 ml-1 font-poppins-medium" style={{ color: theme.colors.text }}>
        {sectionTitle}
      </Text>
      <View className="rounded-2xl shadow-lg" style={{ backgroundColor: theme.colors.card }}>
        {/* Header with toggle switch */}
        <View className="flex-row items-center justify-between p-4">
          <TouchableOpacity
            className="flex-row items-center flex-1"
            onPress={hasMoreThanTwoOptions ? onToggle : undefined}
            activeOpacity={hasMoreThanTwoOptions ? 0.7 : 1}
          >
            <Ionicons name={icon as any} size={24} color={theme.colors.text} />
            <View className="ml-3 flex-1">
              <Text className="text-base font-medium font-poppins-medium" style={{ color: theme.colors.text }}>
                {title}
              </Text>
              {subtitle && (
                <Text className="text-sm mt-0.5 font-poppins" style={{ color: theme.colors.textSecondary }}>
                  {subtitle}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Toggle Switch - Track color matches selected theme */}
          <Switch
            value={toggleValue === true}
            onValueChange={handleToggleSwitch}
            trackColor={{
              false: theme.colors.border,
              true: getTrackColor(),
            }}
            thumbColor={theme.colors.background}
            ios_backgroundColor={theme.colors.border}
          />
        </View>

        {/* Expanded content - Only for 3+ options */}
        {isExpanded && hasMoreThanTwoOptions && (
          <View className="px-4 pb-4 border-t" style={{ borderTopColor: theme.colors.border }}>
            <View className="pt-3">
              <Text
                className="text-sm font-medium mb-3 font-poppins-medium"
                style={{ color: theme.colors.textSecondary }}
              >
                Choose an option:
              </Text>

              {/* Options list - Left to Right, icon + text */}
              <View className="flex-row items-center gap-4">
                {options.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    className="flex-row items-center"
                    onPress={() => handleOptionSelect(option.id)}
                    activeOpacity={0.7}
                  >
                    {option.icon && (
                      <Ionicons
                        name={option.icon as any}
                        size={16}
                        color={theme.colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      className="text-sm font-poppins-medium"
                      style={{
                        color: selectedOptionId === option.id ? theme.colors.primary : theme.colors.text,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom children if provided */}
              {children && <View className="mt-3">{children}</View>}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};
