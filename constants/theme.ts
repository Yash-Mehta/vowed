import { Platform } from 'react-native';

export const theme = {
  colors: {
    // Backgrounds
    bg: '#FAF6F1',
    card: '#FFFFFF',
    surface2: '#F4ECE2',
    surface3: '#EADFD0',
    line: 'rgba(122, 74, 63, 0.14)',
    lineStrong: 'rgba(122, 74, 63, 0.22)',

    // Ink (text)
    ink: '#2A1D17',
    ink2: '#5C463C',
    ink3: '#8C7064',
    ink4: '#B59E91',

    // Brand
    accent: '#7A4A3F',
    accentDeep: '#5C3329',
    accentSoft: '#C58A7A',
    accentTint: '#F1DFD6',

    // Nature palette (tropical garden)
    leaf: '#4A6B4A',
    leafSoft: '#B7C4A8',
    sand: '#E8D9BE',
    sky: '#A9C6D1',

    // Status
    heart: '#B43A3A',

    // Countdown banner gradient
    countdownStart: '#5C3329',
    countdownEnd: '#7A4A3F',

    // Evolved soft luxury — deep wine field (matches native splash) + gold leaf
    wine: '#5C1A1A',
    wineDeep: '#471414',
    gold: '#B08D3E',
    goldSoft: '#D9C08A',
    goldTint: 'rgba(176, 141, 62, 0.14)',
    surfaceRaised: '#FFFDF9',
    creamOnWine: 'rgba(250, 246, 241, 0.72)',
  },

  fonts: {
    serif: Platform.select({
      ios: 'CormorantGaramond-Medium',
      android: 'CormorantGaramond-Medium',
      default: 'Georgia',
    }),
    serifItalic: Platform.select({
      ios: 'CormorantGaramond-Italic',
      android: 'CormorantGaramond-Italic',
      default: 'Georgia',
    }),
    serifMediumItalic: Platform.select({
      ios: 'CormorantGaramond-MediumItalic',
      android: 'CormorantGaramond-MediumItalic',
      default: 'Georgia',
    }),
    sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  },

  radii: {
    sm: 8,
    md: 14,
    lg: 22,
    xl: 28,
    pill: 9999,
  },

  // Spacing rhythm — use these instead of ad-hoc paddings in redesigned surfaces
  space: {
    xs: 4,
    s: 8,
    m: 12,
    l: 18,
    xl: 24,
    xxl: 36,
    section: 48,
  },

  // Type scale for the editorial system. Spread into StyleSheet entries:
  //   { ...theme.type.display, color: theme.colors.ink }
  type: {
    display: { fontSize: 34, lineHeight: 40, letterSpacing: 0.2 },
    title: { fontSize: 24, lineHeight: 30, letterSpacing: 0.2 },
    heading: { fontSize: 18, lineHeight: 24 },
    body: { fontSize: 15, lineHeight: 22 },
    caption: { fontSize: 12, lineHeight: 16 },
    eyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2, textTransform: 'uppercase' as const },
  },

  motion: {
    fast: 150,
    normal: 300,
    slow: 550,
  },

  shadows: {
    s1: {
      shadowColor: '#3C1E14',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    s2: {
      shadowColor: '#3C1E14',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 4,
    },
    s3: {
      shadowColor: '#3C1E14',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.18,
      shadowRadius: 40,
      elevation: 12,
    },
  },
};
