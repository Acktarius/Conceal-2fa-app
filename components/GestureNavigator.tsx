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
  const gestureThreshold = screenWidth * 0.8; // 80% of screen width
  const startX = useRef(0);

  const onGestureEvent = (event: any) => {
    const { translationX, absoluteX } = event.nativeEvent;
    
    // Only trigger if gesture starts from edge and covers 80% of screen
    if (Math.abs(translationX) > gestureThreshold) {
      if (translationX > 0) {
        // Swipe right - navigate to previous tab
        navigateToPreviousTab();
      } else {
        // Swipe left - navigate to next tab
        navigateToNextTab();
      }
    }
  };

  const navigateToPreviousTab = () => {
    const state = navigation.getState();
    const currentIndex = state.index;
    const routes = state.routes;
    
    if (currentIndex > 0) {
      const previousRoute = routes[currentIndex - 1];
      navigation.navigate(previousRoute.name as never);
    }
  };

  const navigateToNextTab = () => {
    const state = navigation.getState();
    const currentIndex = state.index;
    const routes = state.routes;
    
    if (currentIndex < routes.length - 1) {
      const nextRoute = routes[currentIndex + 1];
      navigation.navigate(nextRoute.name as never);
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={(event) => {
        if (event.nativeEvent.state === State.BEGAN) {
          startX.current = event.nativeEvent.absoluteX;
        }
      }}
    >
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </PanGestureHandler>
  );
}