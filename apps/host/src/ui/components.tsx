import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { avatarColors, type Avatar } from "@familyquest/shared";
import { useTheme } from "./theme";
import { SpriteImage } from "./sprite";

/** Chunky, tactile primary button — presses "down" like the web client's. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg =
    variant === "primary"
      ? t.colors.primary
      : variant === "secondary"
        ? t.colors.secondary
        : "transparent";
  const shadow =
    variant === "primary"
      ? t.colors.primaryDeep
      : variant === "secondary"
        ? t.colors.secondaryGlow
        : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === "ghost" ? t.colors.border : "transparent",
          borderWidth: variant === "ghost" ? 2 : 0,
          shadowColor: shadow,
          transform: [{ translateY: pressed ? 3 : 0 }],
          opacity: disabled ? 0.5 : 1,
          ...(variant !== "ghost" && !pressed
            ? { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }
            : {}),
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "ghost" ? t.colors.textSoft : "#fff"} />
      ) : (
        <Text
          style={{
            fontFamily: t.fonts.displayBold,
            fontSize: 19,
            color: variant === "ghost" ? t.colors.textSoft : "#fff",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surfaceRaised,
          borderColor: t.colors.border,
          borderWidth: 2,
          borderRadius: t.radii.card,
          padding: t.spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text style={[{ fontFamily: t.fonts.displayBold, fontSize: t.sizes.title, color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text style={[{ fontFamily: t.fonts.body, fontSize: t.sizes.body, color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text style={[{ fontFamily: t.fonts.body, fontSize: t.sizes.small, color: t.colors.textSoft }, style]}>
      {children}
    </Text>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: t.radii.chip,
        borderWidth: 2,
        borderColor: selected ? t.colors.primary : t.colors.border,
        backgroundColor: selected ? t.colors.primaryGlow : t.colors.surfaceRaised,
        paddingHorizontal: 14,
        paddingVertical: 8,
        transform: [{ scale: selected ? 1.05 : 1 }],
      }}
    >
      <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function AvatarBadge({
  avatar,
  size = 48,
  knockedOut,
}: {
  avatar: Avatar;
  size?: number;
  knockedOut?: boolean;
}) {
  const bg = (avatarColors as Record<string, string>)[avatar.color] ?? avatarColors.sunshine;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "rgba(255,255,255,0.7)",
        opacity: knockedOut ? 0.55 : 1,
        overflow: avatar.sprite ? "hidden" : undefined,
      }}
    >
      {avatar.sprite ? (
        <SpriteImage sprite={avatar.sprite} size={size - 6} />
      ) : (
        <Text style={{ fontSize: size * 0.5 }}>{avatar.emoji}</Text>
      )}
      {avatar.accessory ? (
        <Text style={{ position: "absolute", top: -8, right: -6, fontSize: size * 0.34 }}>
          {avatar.accessory}
        </Text>
      ) : null}
      {knockedOut ? (
        <Text style={{ position: "absolute", bottom: -6, right: -6, fontSize: size * 0.34 }}>💫</Text>
      ) : null}
    </View>
  );
}

export function HeartsRow({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <Text style={{ fontSize: 13, letterSpacing: 1 }}>
      {Array.from({ length: maxHp }, (_, i) => (i < hp ? "❤️" : "🤍")).join("")}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
