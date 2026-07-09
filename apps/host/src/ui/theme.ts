import { useColorScheme } from "react-native";
import {
  darkColors,
  lightColors,
  radii,
  spacing,
  typography,
  type ThemeColors,
} from "@familyquest/shared";

export interface Theme {
  colors: ThemeColors;
  radii: typeof radii;
  spacing: typeof spacing;
  fonts: {
    display: string;
    displayBold: string;
    body: string;
    bodySemibold: string;
    bodyBold: string;
  };
  sizes: typeof typography.sizes;
  dark: boolean;
}

/** Font family names as registered with expo-font in App.tsx. */
export const FONTS = {
  display: "Fredoka_500Medium",
  displayBold: "Fredoka_600SemiBold",
  body: "Nunito_400Regular",
  bodySemibold: "Nunito_600SemiBold",
  bodyBold: "Nunito_800ExtraBold",
} as const;

export function useTheme(): Theme {
  const dark = useColorScheme() === "dark";
  return {
    colors: dark ? darkColors : lightColors,
    radii,
    spacing,
    fonts: FONTS,
    sizes: typography.sizes,
    dark,
  };
}
