import type { Avatar, Character } from "@familyquest/shared";
import { avatarColors, type AvatarColorName } from "@familyquest/shared";
import { SpriteImg } from "./sprite.js";

export function resolveAvatarColor(token: string): string {
  return (avatarColors as Record<string, string>)[token] ?? avatarColors.sunshine;
}

export function AvatarBadge({
  avatar,
  size = 56,
  knockedOut = false,
}: {
  avatar: Avatar;
  size?: number;
  knockedOut?: boolean;
}) {
  return (
    <span
      className={`avatar-badge${knockedOut ? " knocked-out" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.54,
        background: resolveAvatarColor(avatar.color),
        overflow: avatar.sprite ? "hidden" : undefined,
      }}
    >
      {avatar.sprite ? <SpriteImg sprite={avatar.sprite} size={size} /> : avatar.emoji}
      {avatar.accessory ? <span className="accessory">{avatar.accessory}</span> : null}
    </span>
  );
}

export function Hearts({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <span className="hearts" aria-label={`${hp} of ${maxHp} hearts`}>
      {Array.from({ length: maxHp }, (_, i) => (
        <span key={i}>{i < hp ? "❤️" : "🤍"}</span>
      ))}
    </span>
  );
}

export function CharacterStrip({ character }: { character: Character }) {
  return (
    <div className="row card" style={{ padding: 12 }}>
      <AvatarBadge avatar={character.avatar} knockedOut={character.status === "knockedOut"} />
      <div className="grow">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{character.name}</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {character.species}
        </div>
      </div>
      <div className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
        <Hearts hp={character.hp} maxHp={character.maxHp} />
        <div style={{ fontSize: 15 }}>{character.items.map((it) => it.emoji).join(" ")}</div>
      </div>
    </div>
  );
}

const SPARKLES = ["✨", "⭐", "💫", "🌟", "✨", "⭐", "💛", "✨"];

export function SparkleBurst() {
  return (
    <div className="sparkles" aria-hidden>
      {SPARKLES.map((s, i) => {
        const angle = (i / SPARKLES.length) * Math.PI * 2;
        const distance = 90 + (i % 3) * 30;
        return (
          <span
            key={i}
            style={
              {
                "--dx": `${Math.cos(angle) * distance}px`,
                "--dy": `${Math.sin(angle) * distance}px`,
                animationDelay: `${i * 40}ms`,
              } as React.CSSProperties
            }
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

/** Stylized d20 silhouette (hexagon with inner triangle facets). */
export function D20Shape({
  color,
  children,
  className,
  onClick,
}: {
  color: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div className={`d20 ${className ?? ""}`} onClick={onClick} role="button" tabIndex={0}>
      <svg viewBox="0 0 100 110" width="100%" height="100%" aria-hidden>
        <defs>
          <linearGradient id="d20g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor="#00000055" />
          </linearGradient>
        </defs>
        {/* hexagonal die body */}
        <polygon
          points="50,2 95,29 95,81 50,108 5,81 5,29"
          fill={`url(#d20g)`}
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* central face */}
        <polygon
          points="50,20 82,72 18,72"
          fill="rgba(255,255,255,0.14)"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* facet lines */}
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="2">
          <line x1="50" y1="2" x2="50" y2="20" />
          <line x1="95" y1="29" x2="82" y2="72" />
          <line x1="5" y1="29" x2="18" y2="72" />
          <line x1="50" y1="108" x2="82" y2="72" />
          <line x1="50" y1="108" x2="18" y2="72" />
        </g>
      </svg>
      <span className="face-number">{children}</span>
    </div>
  );
}
