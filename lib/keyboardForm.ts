import type { RefObject } from 'react';
import { Keyboard, ScrollView } from 'react-native';

export function dismissKeyboard(): void {
  Keyboard.dismiss();
}

export function scrollToEndAfterLayout(scrollRef: RefObject<ScrollView | null>): void {
  requestAnimationFrame(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  });
}

export function showFormError(
  scrollRef: RefObject<ScrollView | null>,
  setError: (message: string) => void,
  message: string,
): void {
  Keyboard.dismiss();
  setError(message);
  scrollToEndAfterLayout(scrollRef);
}
