import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

type SpinningSyncIconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Continuously rotating sync arrow for in-progress wallet sync UI. */
export function SpinningSyncIcon({ size = 24, color = '#000', style }: SpinningSyncIconProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spinAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[{ transform: [{ rotate }] }, style]}>
      <Ionicons name="sync-outline" size={size} color={color} />
    </Animated.View>
  );
}
