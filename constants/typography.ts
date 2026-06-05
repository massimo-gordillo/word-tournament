import { Platform, TextStyle } from 'react-native';

/**
 * Merriweather is a screen-optimized serif bundled for iOS/Android/Web.
 * It is used here as a Georgia-like stand-in (Georgia is iOS-only and not redistributable).
 */
export const AppFonts = {
  regular: 'Merriweather_400Regular',
  medium: 'Merriweather_500Medium',
  semiBold: 'Merriweather_600SemiBold',
  bold: 'Merriweather_700Bold',
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

export function fontFamilyForWeight(weight?: TextStyle['fontWeight']): string {
  if (
    weight === 'bold' ||
    weight === '700' ||
    weight === 700 ||
    weight === '800' ||
    weight === 800 ||
    weight === '900' ||
    weight === 900
  ) {
    return AppFonts.bold;
  }

  if (weight === '600' || weight === 600) {
    return AppFonts.semiBold;
  }

  if (weight === '500' || weight === 500) {
    return AppFonts.medium;
  }

  return AppFonts.regular;
}

export function withAppFont(style: TextStyle): TextStyle {
  if (style.fontFamily) {
    return style;
  }

  const { fontWeight, ...rest } = style;

  return {
    ...rest,
    fontFamily: fontFamilyForWeight(fontWeight),
  };
}

export const TextStyles = {
  display: {
    fontSize: FontSize['5xl'],
    fontFamily: AppFonts.bold,
  },
  screenTitle: {
    fontSize: FontSize['4xl'],
    fontFamily: AppFonts.bold,
  },
  titleLarge: {
    fontSize: FontSize['3xl'],
    fontFamily: AppFonts.bold,
  },
  title: {
    fontSize: FontSize['2xl'],
    fontFamily: AppFonts.semiBold,
  },
  titleBold: {
    fontSize: FontSize['2xl'],
    fontFamily: AppFonts.bold,
  },
  subtitle: {
    fontSize: FontSize.xl,
    fontFamily: AppFonts.semiBold,
  },
  label: {
    fontSize: FontSize.lg,
    fontFamily: AppFonts.semiBold,
  },
  body: {
    fontSize: FontSize.lg,
    fontFamily: AppFonts.regular,
  },
  bodyMedium: {
    fontSize: FontSize.base,
    fontFamily: AppFonts.regular,
  },
  bodyMediumSemiBold: {
    fontSize: FontSize.base,
    fontFamily: AppFonts.semiBold,
  },
  bodySmall: {
    fontSize: FontSize.md,
    fontFamily: AppFonts.regular,
  },
  bodySmallMedium: {
    fontSize: FontSize.md,
    fontFamily: AppFonts.medium,
  },
  bodySmallSemiBold: {
    fontSize: FontSize.md,
    fontFamily: AppFonts.semiBold,
  },
  caption: {
    fontSize: FontSize.sm,
    fontFamily: AppFonts.regular,
  },
  captionSemiBold: {
    fontSize: FontSize.sm,
    fontFamily: AppFonts.semiBold,
  },
  captionSmall: {
    fontSize: FontSize.xs,
    fontFamily: AppFonts.regular,
  },
  captionSmallSemiBold: {
    fontSize: FontSize.xs,
    fontFamily: AppFonts.semiBold,
  },
  mono: {
    fontSize: FontSize.sm,
    fontFamily: AppFonts.mono,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof TextStyles;
