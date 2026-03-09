import { useRef } from 'react';
import { Animated, Platform } from 'react-native';

// Use react-native-haptic-feedback if available, fall back to no-op silently
let HapticFeedback: any = null;
try {
  HapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  // not installed — haptics will be silent
}

type Options = {
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'none';
};

export function usePressAnimation(options: Options = {}) {
  const { scaleTo = 0.96, haptic = 'light' } = options;
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const fireHaptic = () => {
    if (haptic === 'none') {return;}
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {return;}
    if (!HapticFeedback) {return;}
    const type = haptic === 'medium' ? 'impactMedium' : 'impactLight';
    HapticFeedback.trigger(type, { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
  };

  return {
    scale,
    handlers: {
      onPressIn: pressIn,
      onPressOut: pressOut,
    },
    fireHaptic,
  };
}
