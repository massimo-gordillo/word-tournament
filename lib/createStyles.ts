import {
  ImageStyle,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { withAppFont } from '@/constants/typography';

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

function isTextStyle(style: ViewStyle | TextStyle | ImageStyle): style is TextStyle {
  return 'fontSize' in style || 'fontWeight' in style || 'fontFamily' in style;
}

export function createStyles<T extends NamedStyles<T>>(styles: T): T {
  const processed = {} as T;

  for (const key of Object.keys(styles) as (keyof T)[]) {
    const style = styles[key];

    if (isTextStyle(style)) {
      processed[key] = withAppFont(style) as T[keyof T];
      continue;
    }

    processed[key] = style;
  }

  return StyleSheet.create(processed);
}
