/**
 * Design System Spacing Tokens
 * British Army Ski Race Application
 */

// Base unit: 8px
const BASE_UNIT = 8;

export const spacing = {
  0: '0',
  px: '1px',
  0.5: `${BASE_UNIT * 0.0625}rem`,  // 2px
  1: `${BASE_UNIT * 0.125}rem`,     // 4px
  1.5: `${BASE_UNIT * 0.1875}rem`,  // 6px
  2: `${BASE_UNIT * 0.25}rem`,      // 8px
  2.5: `${BASE_UNIT * 0.3125}rem`,  // 10px
  3: `${BASE_UNIT * 0.375}rem`,     // 12px
  3.5: `${BASE_UNIT * 0.4375}rem`,  // 14px
  4: `${BASE_UNIT * 0.5}rem`,       // 16px
  5: `${BASE_UNIT * 0.625}rem`,     // 20px
  6: `${BASE_UNIT * 0.75}rem`,      // 24px
  7: `${BASE_UNIT * 0.875}rem`,     // 28px
  8: `${BASE_UNIT * 1}rem`,         // 32px
  9: `${BASE_UNIT * 1.125}rem`,     // 36px
  10: `${BASE_UNIT * 1.25}rem`,     // 40px
  11: `${BASE_UNIT * 1.375}rem`,    // 44px
  12: `${BASE_UNIT * 1.5}rem`,      // 48px
  14: `${BASE_UNIT * 1.75}rem`,     // 56px
  16: `${BASE_UNIT * 2}rem`,        // 64px
  20: `${BASE_UNIT * 2.5}rem`,      // 80px
  24: `${BASE_UNIT * 3}rem`,        // 96px
  28: `${BASE_UNIT * 3.5}rem`,      // 112px
  32: `${BASE_UNIT * 4}rem`,        // 128px
  36: `${BASE_UNIT * 4.5}rem`,      // 144px
  40: `${BASE_UNIT * 5}rem`,        // 160px
  44: `${BASE_UNIT * 5.5}rem`,      // 176px
  48: `${BASE_UNIT * 6}rem`,        // 192px
  52: `${BASE_UNIT * 6.5}rem`,      // 208px
  56: `${BASE_UNIT * 7}rem`,        // 224px
  60: `${BASE_UNIT * 7.5}rem`,      // 240px
  64: `${BASE_UNIT * 8}rem`,        // 256px
  72: `${BASE_UNIT * 9}rem`,        // 288px
  80: `${BASE_UNIT * 10}rem`,       // 320px
  96: `${BASE_UNIT * 12}rem`,       // 384px
} as const;

// Border Radius
export const borderRadius = {
  none: '0',
  sm: '0.125rem',    // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  '3xl': '1.5rem',   // 24px
  full: '9999px',
} as const;

// Shadows
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
} as const;

// Z-Index Scale
export const zIndex = {
  0: 0,
  10: 10,
  20: 20,
  30: 30,
  40: 40,
  50: 50,
  auto: 'auto',
  // Named layers
  base: 0,
  dropdown: 100,
  sticky: 200,
  banner: 300,
  overlay: 400,
  modal: 500,
  popover: 600,
  toast: 700,
  tooltip: 800,
} as const;

// Breakpoints
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Container widths
export const containers = {
  xs: '100%',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// CSS Custom Properties
export const cssSpacingVars = `
  :root {
    /* Base spacing unit */
    --space-unit: ${BASE_UNIT}px;
    
    /* Common spacing values */
    --space-0: ${spacing[0]};
    --space-1: ${spacing[1]};
    --space-2: ${spacing[2]};
    --space-3: ${spacing[3]};
    --space-4: ${spacing[4]};
    --space-5: ${spacing[5]};
    --space-6: ${spacing[6]};
    --space-8: ${spacing[8]};
    --space-10: ${spacing[10]};
    --space-12: ${spacing[12]};
    --space-16: ${spacing[16]};
    --space-20: ${spacing[20]};
    --space-24: ${spacing[24]};
    
    /* Border radius */
    --radius-sm: ${borderRadius.sm};
    --radius-default: ${borderRadius.DEFAULT};
    --radius-md: ${borderRadius.md};
    --radius-lg: ${borderRadius.lg};
    --radius-xl: ${borderRadius.xl};
    --radius-full: ${borderRadius.full};
    
    /* Shadows */
    --shadow-sm: ${shadows.sm};
    --shadow-default: ${shadows.DEFAULT};
    --shadow-md: ${shadows.md};
    --shadow-lg: ${shadows.lg};
    --shadow-xl: ${shadows.xl};
  }
`;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof borderRadius;
export type ShadowToken = keyof typeof shadows;
export type BreakpointToken = keyof typeof breakpoints;