import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import WalletScreen from '../screens/WalletScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

// Custom tab icon component with hover effect
function TabIcon({ name, size, color, focused, theme }: { 
  name: keyof typeof Ionicons.glyphMap; 
  size: number; 
  color: string; 
  focused: boolean;
  theme: any;
}) {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease-in-out',
          filter: focused && theme.isDark ? 'drop-shadow(0 0 1px #FFA500)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (theme.isDark) {
            e.currentTarget.style.filter = 'drop-shadow(0 0 2px #FFA500)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (theme.isDark) {
            e.currentTarget.style.filter = focused ? 'drop-shadow(0 0 2px #FFA500)' : 'none';
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        <Ionicons name={name} size={size} color={color} />
      </div>
    );
  }
  
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabNavigator() {
  const { theme } = useTheme();

  return (
    <View className="flex-1">
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Home') {
              iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
            } else if (route.name === 'Wallet') {
              iconName = focused ? 'wallet' : 'wallet-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            } else {
              iconName = 'help-outline';
            }

            return <TabIcon name={iconName} size={size} color={color} focused={focused} theme={theme} />;
          },
          tabBarActiveTintColor: theme.colors.tabBarActive,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
          tabBarStyle: {
            backgroundColor: theme.colors.tabBar,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingTop: 8,
            paddingBottom: 13,
            height: 65,
          },
          headerShown: false,
        })}
        initialRouteName="Home"
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ 
            title: 'Authenticator',
            tabBarLabelStyle: {
              fontFamily: 'Poppins-Light',
              fontSize: 11,
            }
          }}
        />
        <Tab.Screen 
          name="Wallet" 
          component={WalletScreen} 
          options={{ 
            title: 'Wallet',
            tabBarLabelStyle: {
              fontFamily: 'Poppins-Light',
              fontSize: 11,
            }
          }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ 
            title: 'Settings',
            tabBarLabelStyle: {
              fontFamily: 'Poppins-Light',
              fontSize: 11
            }
          }}
        />
      </Tab.Navigator>
    </View>
  );
}