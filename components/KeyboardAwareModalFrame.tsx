import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';

type KeyboardAwareModalFrameProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function KeyboardAwareModalFrame({ children, style }: KeyboardAwareModalFrameProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
