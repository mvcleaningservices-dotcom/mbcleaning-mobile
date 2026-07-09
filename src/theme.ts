/**
 * MV Cleaning — Mobile design tokens.
 *
 * ⚠️ SINGLE SOURCE OF TRUTH for the brand palette: these values are kept in sync
 * with `admin/src/tokens.css` and `web/src/tokens.css` (the canonical hex set).
 * To re-brand: change the `primary*` / `accent*` values HERE and the matching
 * `--color-primary-*` in the two tokens.css files — nothing else. (Full
 * unification into one shared `packages/design-tokens` happens at the monorepo
 * stage — see HomeServices_Clone_Plan.md §7.)
 */
export const theme = {
  colors: {
    // Primary — brand teal (canonical, matches tokens.css)
    primary50: '#f0fdfa',
    primary100: '#ccfbf1',
    primary200: '#99f6e4',
    primary300: '#5eead4',
    primary400: '#2dd4bf',
    primary500: '#14b8a6',
    primary600: '#0d9488', // Brand Main
    primary700: '#0f766e', // hover
    primary800: '#115e59',
    primary900: '#134e4a',

    // Accent — warm orange (canonical) for high-intent highlights
    accent500: '#f97316',
    accent600: '#ea580c',

    // Backgrounds
    background: '#ffffff',
    surface: '#ffffff',
    surfaceSubtle: '#f8fafc',
    surfaceMuted: '#f1f5f9',

    // Text
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    textInverse: '#ffffff',

    // Borders
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    borderFocus: '#5eead4',

    // Status (canonical, matches tokens.css)
    success: '#16a34a',
    successBg: '#f0fdf4',
    error: '#dc2626',
    errorBg: '#fef2f2',
    warning: '#d97706',
    warningBg: '#fffbeb',
    warningText: '#b45309',
    info: '#2563eb',
    infoBg: '#eff6ff',

    // Gradients & Overlays
    overlay: 'rgba(15, 23, 42, 0.4)',
    shimmer: '#e2e8f0',
  },
  
  typography: {
    fontFamily: {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semiBold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
      extraBold: 'Inter_800ExtraBold',
    },
    sizes: {
      xs: 12,
      sm: 14,
      md: 16, // Base
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
  },
  
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    pill: 9999,
  },
  
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
  }
};
