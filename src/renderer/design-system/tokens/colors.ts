/**
 * Design System Color Tokens
 * British Army Ski Race Application
 */

export const colors = {
  // Primary Palette - Military Heritage
  primary: {
    50: '#E1F0FF',
    100: '#B3D4FF',
    300: '#4A90E2',
    500: '#2C5282',
    700: '#1E3A5F',
    900: '#0A1628',
  },
  
  // Alpine Theme
  alpine: {
    white: '#FFFFFF',
    ice: '#F0F9FF',
    shadow: '#64748B',
    rock: '#475569',
  },
  
  // Competition Colors
  competition: {
    gold: '#FFB800',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  },
  
  // Semantic Colors
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },
  
  // Neutral Colors
  neutral: {
    0: '#FFFFFF',
    50: '#FAFBFC',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },
  
  // System Colors
  background: '#FAFBFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: {
    primary: '#1A202C',
    secondary: '#64748B',
    disabled: '#CBD5E1',
    inverse: '#FFFFFF',
  },
} as const;

// CSS Custom Properties
export const cssColorVars = `
  :root {
    /* Primary Colors */
    --color-primary-50: ${colors.primary[50]};
    --color-primary-100: ${colors.primary[100]};
    --color-primary-300: ${colors.primary[300]};
    --color-primary-500: ${colors.primary[500]};
    --color-primary-700: ${colors.primary[700]};
    --color-primary-900: ${colors.primary[900]};
    
    /* Alpine Colors */
    --color-alpine-white: ${colors.alpine.white};
    --color-alpine-ice: ${colors.alpine.ice};
    --color-alpine-shadow: ${colors.alpine.shadow};
    --color-alpine-rock: ${colors.alpine.rock};
    
    /* Competition Colors */
    --color-gold: ${colors.competition.gold};
    --color-silver: ${colors.competition.silver};
    --color-bronze: ${colors.competition.bronze};
    
    /* Semantic Colors */
    --color-success: ${colors.semantic.success};
    --color-warning: ${colors.semantic.warning};
    --color-danger: ${colors.semantic.danger};
    --color-info: ${colors.semantic.info};
    
    /* System Colors */
    --color-background: ${colors.background};
    --color-surface: ${colors.surface};
    --color-border: ${colors.border};
    --color-text-primary: ${colors.text.primary};
    --color-text-secondary: ${colors.text.secondary};
    --color-text-disabled: ${colors.text.disabled};
    --color-text-inverse: ${colors.text.inverse};
  }
`;

export type ColorToken = keyof typeof colors;