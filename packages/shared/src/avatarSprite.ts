/**
 * Avatar sprite options for the DiceBear "avataaars" style
 * (art by Pablo Stanley, https://avataaars.com — free for personal & commercial use;
 * generated locally via @dicebear/avataaars, no network calls).
 *
 * The catalogs below are curated, kid-friendly subsets of the style's schema.
 * Both apps render the same sprite from these options, so they live in shared.
 */

/** Skin tones (hex, no leading #). */
export const SPRITE_SKIN_COLORS = [
  "ffdbb4",
  "f8d25c",
  "edb98a",
  "fd9841",
  "d08b5b",
  "ae5d29",
  "614335",
] as const;

/** Hair styles ("top" values that are hair). */
export const SPRITE_HAIR = [
  "shortFlat",
  "shortRound",
  "shortWaved",
  "shortCurly",
  "theCaesar",
  "sides",
  "frizzle",
  "shaggy",
  "dreads01",
  "dreads02",
  "bob",
  "bun",
  "curly",
  "bigHair",
  "longButNotTooLong",
  "straight02",
  "straightAndStrand",
  "miaWallace",
  "fro",
  "froBand",
] as const;

/** Hat / head-wear styles ("top" values that are hats). */
export const SPRITE_HATS = [
  "hat",
  "winterHat02",
  "winterHat03",
  "winterHat04",
  "turban",
  "hijab",
] as const;

/** All valid "top" values (empty string = bald / no head-wear). */
export const SPRITE_TOPS = [...SPRITE_HAIR, ...SPRITE_HATS] as const;

export const SPRITE_HAIR_COLORS = [
  "2c1b18",
  "4a312c",
  "724133",
  "a55728",
  "b58143",
  "d6b370",
  "ecdcbf",
  "e8e1e1",
  "c93305",
  "f59797",
] as const;

/** Shared palette for hats & clothes (hex, no leading #). */
export const SPRITE_FABRIC_COLORS = [
  "ff5c5c",
  "ff488e",
  "ffafb9",
  "ffffb1",
  "a7ffc4",
  "65c9ff",
  "5199e4",
  "25557c",
  "3c4f5c",
  "929598",
  "e6e6e6",
  "262e33",
] as const;

export const SPRITE_CLOTHING = [
  "shirtCrewNeck",
  "shirtVNeck",
  "shirtScoopNeck",
  "graphicShirt",
  "hoodie",
  "overall",
  "collarAndSweater",
  "blazerAndShirt",
  "blazerAndSweater",
] as const;

/** Kid-friendly eye expressions. */
export const SPRITE_EYES = [
  "default",
  "happy",
  "wink",
  "hearts",
  "squint",
  "surprised",
  "side",
  "closed",
] as const;

/** Kid-friendly mouths. */
export const SPRITE_MOUTHS = [
  "smile",
  "default",
  "twinkle",
  "tongue",
  "eating",
  "serious",
  "grimace",
] as const;

/** Glasses & friends (empty string = none). */
export const SPRITE_ACCESSORIES = [
  "round",
  "prescription01",
  "prescription02",
  "wayfarers",
  "sunglasses",
  "kurt",
  "eyepatch",
] as const;

/** Beards & moustaches (empty string = none). */
export const SPRITE_FACIAL_HAIR = [
  "beardLight",
  "beardMedium",
  "beardMajestic",
  "moustacheFancy",
  "moustacheMagnum",
] as const;

/** Player-picked sprite look; every value comes from the catalogs above. */
export interface AvatarSprite {
  skinColor: string;
  /** Hair or hat style; empty string = bald. */
  top: string;
  hairColor: string;
  /** Used when `top` is a hat. */
  hatColor: string;
  clothing: string;
  clothesColor: string;
  eyes: string;
  mouth: string;
  /** Glasses etc.; empty string = none. */
  accessory: string;
  /** Beard / moustache; empty string = none. */
  facialHair: string;
}

export function isSpriteHat(top: string): boolean {
  return (SPRITE_HATS as readonly string[]).includes(top);
}

export function defaultSprite(): AvatarSprite {
  return {
    skinColor: "edb98a",
    top: "shortWaved",
    hairColor: "724133",
    hatColor: "5199e4",
    clothing: "hoodie",
    clothesColor: "65c9ff",
    eyes: "happy",
    mouth: "smile",
    accessory: "",
    facialHair: "",
  };
}

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)]!;
}

/** Random but sensible sprite; pass a rand fn for determinism in tests. */
export function randomSprite(rand: () => number = Math.random): AvatarSprite {
  return {
    skinColor: pick(SPRITE_SKIN_COLORS, rand),
    top: pick(SPRITE_TOPS, rand),
    hairColor: pick(SPRITE_HAIR_COLORS, rand),
    hatColor: pick(SPRITE_FABRIC_COLORS, rand),
    clothing: pick(SPRITE_CLOTHING, rand),
    clothesColor: pick(SPRITE_FABRIC_COLORS, rand),
    eyes: pick(SPRITE_EYES, rand),
    mouth: pick(SPRITE_MOUTHS, rand),
    accessory: rand() < 0.25 ? pick(SPRITE_ACCESSORIES, rand) : "",
    facialHair: rand() < 0.15 ? pick(SPRITE_FACIAL_HAIR, rand) : "",
  };
}

/**
 * Map an AvatarSprite to @dicebear/avataaars options.
 * Kept here (plain data, no dicebear import) so both apps stay in sync.
 */
export function spriteToAvataaarsOptions(sprite: AvatarSprite): Record<string, unknown> {
  return {
    top: sprite.top ? [sprite.top] : [],
    topProbability: sprite.top ? 100 : 0,
    hairColor: [sprite.hairColor],
    hatColor: [sprite.hatColor],
    skinColor: [sprite.skinColor],
    clothing: [sprite.clothing],
    clothesColor: [sprite.clothesColor],
    eyes: [sprite.eyes],
    mouth: [sprite.mouth],
    eyebrows: ["defaultNatural"],
    accessories: sprite.accessory ? [sprite.accessory] : [],
    accessoriesProbability: sprite.accessory ? 100 : 0,
    accessoriesColor: ["262e33"],
    facialHair: sprite.facialHair ? [sprite.facialHair] : [],
    facialHairProbability: sprite.facialHair ? 100 : 0,
    facialHairColor: [sprite.hairColor],
  };
}
