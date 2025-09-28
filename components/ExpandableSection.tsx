import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export interface ExpandableSectionProps {
  title: string;
  subtitle?: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  title,
  subtitle,
  icon,
  isExpanded,
  onToggle,
  children,
  className = "mb-6",
}) => {
  const { theme } = useTheme();

  return (
    <View className={className}>
      <Text 
        className="text-base font-semibold mb-2 ml-1 font-poppins-medium" 
        style={{ color: theme.colors.text }}
      >
        {title}
      </Text>
      <View 
        className="rounded-2xl shadow-lg" 
        style={{ backgroundColor: theme.colors.card }}
      >
        <TouchableOpacity
          className="flex-row items-center justify-between p-4"
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center flex-1">
            <Ionicons name={icon as any} size={24} color={theme.colors.text} />
            <View className="ml-3 flex-1">
              <Text 
                className="text-base font-medium font-poppins-medium" 
                style={{ color: theme.colors.text }}
              >
                {title}
              </Text>
              {subtitle && (
                <Text 
                  className="text-sm mt-0.5 font-poppins" 
                  style={{ color: theme.colors.textSecondary }}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={18} 
            color={theme.colors.textSecondary} 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View className="px-4 pb-4">
            {children}
          </View>
        )}
      </View>
    </View>
  );
};
