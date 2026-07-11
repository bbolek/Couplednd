import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";
import { spriteToAvataaarsOptions, type AvatarSprite } from "@familyquest/shared";

/** Render an AvatarSprite as an inline SVG data-URI image (generated locally). */
export function spriteDataUri(sprite: AvatarSprite): string {
  return createAvatar(avataaars, {
    seed: "familyquest",
    ...spriteToAvataaarsOptions(sprite),
  }).toDataUri();
}

export function SpriteImg({
  sprite,
  size,
  style,
}: {
  sprite: AvatarSprite;
  size: number;
  style?: React.CSSProperties;
}) {
  const uri = useMemo(() => spriteDataUri(sprite), [sprite]);
  return (
    <img
      src={uri}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ display: "block", ...style }}
    />
  );
}
