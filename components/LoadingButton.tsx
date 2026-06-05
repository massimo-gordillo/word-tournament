import { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { AppColors } from '@/constants/colors';

type LoadingButtonProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  disabledStyle?: StyleProp<ViewStyle>;
  indicatorColor?: string;
  accessibilityLabel?: string;
  children: ReactNode;
};

export function LoadingButton({
  onPress,
  loading = false,
  disabled = false,
  style,
  disabledStyle = styles.disabled,
  indicatorColor = AppColors.text.inverse,
  accessibilityLabel,
  children,
}: LoadingButtonProps) {
  const blocked = loading || disabled;

  return (
    <TouchableOpacity
      style={[style, blocked && disabledStyle]}
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {loading ? <ActivityIndicator color={indicatorColor} /> : children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.6,
  },
});
