import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import { TextStyles, TextVariant } from '@/constants/typography';

type AppTextProps = TextProps & {
  variant?: TextVariant;
};

export function AppText({ variant, style, ...props }: AppTextProps) {
  const resolvedStyle: StyleProp<TextStyle> = variant
    ? [TextStyles[variant], style]
    : style;

  return <Text style={resolvedStyle} {...props} />;
}
