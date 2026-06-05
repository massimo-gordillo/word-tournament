import { Platform, TextStyle } from 'react-native';

/** Omit fontFamily on UI text to use the platform default (SF Pro on iOS, Roboto on Android). */
export const AppFonts = {
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }) as string,
} as const;

export const FontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
} as const;

export function withAppFont(style: TextStyle): TextStyle {
  return style;
}

export const TextStyles = {
  display: {
    fontSize: FontSize['5xl'],
    fontWeight: 'bold',
  },
  screenTitle: {
    fontSize: FontSize['4xl'],
    fontWeight: 'bold',
  },
  titleLarge: {
    fontSize: FontSize['3xl'],
    fontWeight: 'bold',
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: '600',
  },
  titleBold: {
    fontSize: FontSize['2xl'],
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
  },
  label: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  body: {
    fontSize: FontSize.lg,
  },
  bodyMedium: {
    fontSize: FontSize.base,
  },
  bodyMediumSemiBold: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  bodySmall: {
    fontSize: FontSize.md,
  },
  bodySmallMedium: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  bodySmallSemiBold: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  caption: {
    fontSize: FontSize.sm,
  },
  captionSemiBold: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  captionSmall: {
    fontSize: FontSize.xs,
  },
  captionSmallSemiBold: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  mono: {
    fontSize: FontSize.sm,
    fontFamily: AppFonts.mono,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof TextStyles;
