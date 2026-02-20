import { Platform } from 'react-native';

export const COLORS = {
  primary: '#135BEC',
  primaryLight: '#E9EFFD',
  secondary: '#F97316', // Laranja para contraste

  background: '#F6F6F8', // Fundo cinza claro
  surface: '#FFFFFF', // Branco para cards, inputs etc.
  
  textPrimary: '#0F172A', // Slate escuro para títulos
  textSecondary: '#475569', // Slate mais claro para corpo de texto
  textMuted: '#94A3B8', // Cinza para legendas, texto desabilitado
  textOnPrimary: '#FFFFFF',

  border: '#E2E8F0',
  
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  
  live: '#EF4444',
  
  // Cores para zonas de classificação
  zone1: '#3b82f6', // Champions
  zone2: '#06b6d4', // Europa
  zone3: '#f59e0b', // Conference
  zone4: '#ef4444', // Rebaixamento

  // Cor de fundo para telas escuras
  backgroundDark: '#0F172A',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  h3: 20,
  h2: 24,
  h1: 30,
};

export const BORDERS = {
  radiusSmall: 8,
  radiusMedium: 12,
  radiusLarge: 16,
  radiusFull: 9999,
  width: 1,
};

export const SHADOWS = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
    web: {
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    }
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
    web: {
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }
  }),
};

const theme = { COLORS, SPACING, FONT_SIZES, BORDERS, SHADOWS };
export default theme;