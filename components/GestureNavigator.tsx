import React, { useRef } from 'react';
import { View, Dimensions } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';

interface GestureNavigatorProps {
  children: React.ReactNode;
}

export default function GestureNavigator({ children }: GestureNavigatorProps) {
  const navigation = useNavigation();
  const screenWidth = Dimensions.get('window').width;
  const gestureThreshold = screenWidth * 0.3; // 30% of screen width for easier triggering
  const hasTriggered = useRef(false);

  const onHandlerStateChange = (event: any) => {
    const { state, translationX } = event.nativeEvent;
    
    if (state === State.BEGAN) {
      hasTriggered.current = false;
    }
    
    if (state === State.END && !hasTriggered.current) {
      if (Math.abs(translationX) > gestureThreshold) {
        hasTriggered.current = true;
        
        if (translationX > 0) {
          // Swipe right - navigate to previous tab
          navigateToPreviousTab();
        } else {
          // Swipe left - navigate to next tab
          navigateToNextTab();
        }
      }
    }
  };

  const navigateToPreviousTab = () => {
    const state = navigation.getState();
    const currentIndex = state.index;
    
    if (currentIndex > 0) {
      // Navigate to previous tab: Settings → Wallet → Home
      if (currentIndex === 2) { // Settings
        navigation.navigate('Wallet' as never);
      } else if (currentIndex === 1) { // Wallet
        navigation.navigate('Home' as never);
      }
    }
  };

  const navigateToNextTab = () => {
    const state = navigation.getState();
    const currentIndex = state.index;
    
    if (currentIndex < 2) {
      // Navigate to next tab: Home → Wallet → Settings
      if (currentIndex === 0) { // Home
        navigation.navigate('Wallet' as never);
      } else if (currentIndex === 1) { // Wallet
        navigation.navigate('Settings' as never);
      }
    }
  };

  return (
    <PanGestureHandler
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-30, 30]}
      failOffsetY={[-50, 50]}
    >
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </PanGestureHandler>
  );
}