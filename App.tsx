import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, PanGestureHandler, State } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import TabNavigator from './components/TabNavigator';
import { WalletProvider } from './contexts/WalletContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <WalletProvider>
          <AppContent />
        </WalletProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <TabNavigator />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});