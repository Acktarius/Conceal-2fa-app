import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, Platform } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import WalletScreen from './screens/WalletScreen';
import SettingsScreen from './screens/SettingsScreen';
import { WalletProvider } from './contexts/WalletContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

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
export default function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <AppContent />
      </WalletProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
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
              paddingBottom: 8,
              height: 60,
            },
            headerShown: false,
          })}
          initialRouteName="Home"
        >
          <Tab.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'Authenticator' }}
          />
          <Tab.Screen 
            name="Wallet" 
            component={WalletScreen} 
            options={{ title: 'Wallet' }}
          />
          <Tab.Screen 
            name="Settings" 
            component={SettingsScreen} 
            options={{ title: 'Settings' }}
          />
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});