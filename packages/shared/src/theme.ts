/**
 * Family Quest design tokens — the "storybook magical" system.
 *
 * One source of truth for the host app (React Native) and the player web
 * client, so the game feels like a single hand-crafted product. No default
 * component-library grays, no system fonts, no purple-gradient clichés.
 */

export const palette = {
  // Parchment — warm candlelit paper, never pure white.
  parchment: "#FAF3E3",
  parchmentDeep: "#F2E7CF",
  parchmentEdge: "#E4D3B0",

  // Night — the cozy-evening dark mode base, a deep warm indigo-brown.
  night: "#221A2E",
  nightDeep: "#181221",
  nightEdge: "#39304A",

  // Ink — text colors.
  ink: "#3A2E22",
  inkSoft: "#6E5D48",
  moonInk: "#F3EADF",
  moonInkSoft: "#B9A9C9",

  // Candlelight amber — primary action color, the DM's glow.
  amber: "#E8A33C",
  amberDeep: "#C87F1B",
  amberGlow: "#FFD98A",

  // Enchanted teal — secondary, water/magic/links.
  teal: "#2E8C83",
  tealDeep: "#1F655F",
  tealGlow: "#8FD8CF",

  // Soft coral — hearts, warmth, celebration.
  coral: "#F0776B",
  coralDeep: "#D14F44",
  coralGlow: "#FFB3A9",

  // Meadow — success rolls.
  meadow: "#6FA84C",
  meadowGlow: "#C0E5A2",

  // Plum — fumbles & mystery, used sparingly.
  plum: "#7A4E8E",
  plumGlow: "#D3B3E5",
} as const;

/** Avatar badge colors players pick from (token → light/dark-safe hex). */
export const avatarColors = {
  sunshine: "#F7C948",
  coral: "#F0776B",
  meadow: "#8BC34A",
  sky: "#5FB6D9",
  lavender: "#A98BD3",
  bubblegum: "#EF8FB2",
  tangerine: "#F09A4B",
  mint: "#7DD3B0",
} as const;
export type AvatarColorName = keyof typeof avatarColors;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textSoft: string;
  primary: string;
  primaryDeep: string;
  primaryGlow: string;
  secondary: string;
  secondaryGlow: string;
  heart: string;
  heartGlow: string;
  success: string;
  successGlow: string;
  danger: string;
  mystery: string;
  mysteryGlow: string;
}

export const lightColors: ThemeColors = {
  background: palette.parchment,
  surface: palette.parchmentDeep,
  surfaceRaised: "#FFFDF6",
  border: palette.parchmentEdge,
  text: palette.ink,
  textSoft: palette.inkSoft,
  primary: palette.amber,
  primaryDeep: palette.amberDeep,
  primaryGlow: palette.amberGlow,
  secondary: palette.teal,
  secondaryGlow: palette.tealGlow,
  heart: palette.coral,
  heartGlow: palette.coralGlow,
  success: palette.meadow,
  successGlow: palette.meadowGlow,
  danger: palette.coralDeep,
  mystery: palette.plum,
  mysteryGlow: palette.plumGlow,
};

export const darkColors: ThemeColors = {
  background: palette.night,
  surface: palette.nightDeep,
  surfaceRaised: "#2C2340",
  border: palette.nightEdge,
  text: palette.moonInk,
  textSoft: palette.moonInkSoft,
  primary: palette.amber,
  primaryDeep: palette.amberGlow,
  primaryGlow: "#5A4320",
  secondary: palette.tealGlow,
  secondaryGlow: "#1F4642",
  heart: palette.coral,
  heartGlow: "#5C2E29",
  success: palette.meadowGlow,
  successGlow: "#324A21",
  danger: palette.coralGlow,
  mystery: palette.plumGlow,
  mysteryGlow: "#3D2A47",
};

export const radii = {
  chip: 12,
  card: 24,
  sheet: 32,
  round: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

/**
 * Type scale. Display face: "Fredoka" (chunky, friendly). Body face:
 * "Nunito" (round, highly readable). Both loaded via expo-font on the host
 * and Google Fonts on the web client.
 */
export const typography = {
  display: { family: "Fredoka", weights: { regular: 500, bold: 600 } },
  body: { family: "Nunito", weights: { regular: 400, semibold: 600, bold: 800 } },
  sizes: {
    hero: 34,
    title: 26,
    heading: 20,
    body: 17,
    small: 14,
    tiny: 12,
  },
} as const;

export const statMeta = {
  brave: { emoji: "💪", color: palette.coral },
  smart: { emoji: "🧠", color: palette.teal },
  charm: { emoji: "💖", color: "#EF8FB2" },
  sneaky: { emoji: "🐾", color: palette.plum },
} as const;
