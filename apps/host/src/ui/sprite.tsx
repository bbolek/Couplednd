import { useMemo } from "react";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";
import { spriteToAvataaarsOptions, type AvatarSprite } from "@familyquest/shared";

/** Render an AvatarSprite as an inline SVG (generated locally, no network). */
export function spriteSvg(sprite: AvatarSprite): string {
  return createAvatar(avataaars, {
    seed: "familyquest",
    ...spriteToAvataaarsOptions(sprite),
  }).toString();
}

export function SpriteImage({ sprite, size }: { sprite: AvatarSprite; size: number }) {
  const xml = useMemo(() => spriteSvg(sprite), [sprite]);
  return <SvgXml xml={xml} width={size} height={size} />;
}
