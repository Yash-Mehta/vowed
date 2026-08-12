import { useCallback, useRef } from 'react';
import { NativeSyntheticEvent, ScrollView } from 'react-native';

const KEYBOARD_SCROLL_OFFSET = 24;

export function useKeyboardAwareScroll() {
  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToInput = useCallback((e: NativeSyntheticEvent<{ target: number }>) => {
    scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      e.nativeEvent.target,
      KEYBOARD_SCROLL_OFFSET,
      true
    );
  }, []);

  return { scrollViewRef, scrollToInput };
}
