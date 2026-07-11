import { useMemo, useState } from "react";
import {
  avatarColors,
  defaultSprite,
  isSpriteHat,
  isValidAllocation,
  randomSprite,
  SPRITE_ACCESSORIES,
  SPRITE_CLOTHING,
  SPRITE_EYES,
  SPRITE_FABRIC_COLORS,
  SPRITE_FACIAL_HAIR,
  SPRITE_HAIR,
  SPRITE_HAIR_COLORS,
  SPRITE_HATS,
  SPRITE_MOUTHS,
  SPRITE_SKIN_COLORS,
  STAT_POOL,
  STATS,
  statMeta,
  type Avatar,
  type AvatarSprite,
  type CharacterConcept,
  type StatName,
  type Stats,
} from "@familyquest/shared";
import { t } from "../i18n.js";
import { usePlayerStore } from "../state/playerStore.js";
import { AvatarBadge } from "../components/bits.js";
import { SpriteImg } from "../components/sprite.js";

export interface CharacterDraft {
  name: string;
  species: string;
  conceptId?: string;
  avatar: Avatar;
  stats: Stats;
}

const EMPTY_STATS: Stats = { brave: 2, smart: 2, charm: 2, sneaky: 2 };

type LookTab = "skin" | "hair" | "outfit" | "face" | "extras";
const LOOK_TABS: { id: LookTab; emoji: string }[] = [
  { id: "skin", emoji: "🖐️" },
  { id: "hair", emoji: "💇" },
  { id: "outfit", emoji: "👕" },
  { id: "face", emoji: "😊" },
  { id: "extras", emoji: "🕶️" },
];

/** Live personality line from the stat spread — makes numbers feel alive. */
function personality(stats: Stats): string {
  const sorted = [...STATS].sort((a, b) => stats[b] - stats[a]);
  const hi = sorted[0]!;
  const lo = sorted[3]!;
  const hiName = t(`character.stat_${hi}`);
  const loName = t(`character.stat_${lo}`);
  if (stats[hi] === stats[lo]) return "⚖️ " + hiName + " = " + loName;
  return `${statMeta[hi].emoji} ${hiName}! · ${statMeta[lo].emoji} ${loName}…`;
}

function ColorSwatches({
  colors,
  value,
  onPick,
}: {
  colors: readonly string[];
  value: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="swatch-row">
      {colors.map((hex) => (
        <button
          key={hex}
          type="button"
          aria-label={`#${hex}`}
          className={`swatch${value === hex ? " selected" : ""}`}
          style={{ background: `#${hex}` }}
          onClick={() => onPick(hex)}
        />
      ))}
    </div>
  );
}

export function CharacterCreateScreen({
  onSubmit,
}: {
  onSubmit: (draft: CharacterDraft) => void;
}) {
  const concepts = usePlayerStore((s) => s.game?.setup.concepts ?? []);
  const [step, setStep] = useState(0);
  const [concept, setConcept] = useState<CharacterConcept | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("sunshine");
  const [sprite, setSprite] = useState<AvatarSprite>(() => defaultSprite());
  const [tab, setTab] = useState<LookTab>("skin");
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  const spent = STATS.reduce((sum, s) => sum + stats[s], 0);
  const left = STAT_POOL - spent;
  const statsValid = useMemo(() => isValidAllocation(stats), [stats]);

  const steps = concepts.length > 0 ? 4 : 3;
  const stepIndex = concepts.length > 0 ? step : step + 1; // skip concept step if none yet

  function pickConcept(c: CharacterConcept) {
    setConcept(c);
    setName(c.name);
    setStats(c.suggestedStats);
    setStep(1);
  }

  function bump(stat: StatName, delta: 1 | -1) {
    const next = { ...stats, [stat]: stats[stat] + delta };
    if (next[stat] < 0 || next[stat] > 4) return;
    const total = STATS.reduce((sum, s) => sum + next[s], 0);
    if (total > STAT_POOL) return;
    setStats(next);
  }

  function set(patch: Partial<AvatarSprite>) {
    setSprite((s) => ({ ...s, ...patch }));
  }

  const avatar: Avatar = { emoji: concept?.emoji ?? "🙂", color, sprite };

  return (
    <div className="screen" style={{ gap: 20 }}>
      <div className="center" style={{ gap: 6 }}>
        <h1 className="title">{t("character.title")}</h1>
        <div className="step-dots">
          {Array.from({ length: steps }, (_, i) => (
            <span key={i} className={i === stepIndex - (concepts.length > 0 ? 0 : 1) ? "active" : ""} />
          ))}
        </div>
      </div>

      {stepIndex === 0 && (
        <section className="stack">
          <div>
            <h2 style={{ fontSize: 20 }}>{t("character.stepConcept")}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {t("character.stepConceptHint")}
            </p>
          </div>
          <div className="concept-grid">
            {concepts.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`concept-card${concept?.id === c.id ? " selected" : ""}`}
                onClick={() => pickConcept(c)}
              >
                <span className="concept-emoji" aria-hidden>
                  {c.emoji}
                </span>
                <span className="concept-name">{c.name}</span>
                <div className="concept-tagline">{c.tagline}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {stepIndex === 1 && (
        <section className="stack" style={{ flex: 1 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{t("character.stepName")}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {t("character.stepNameHint")}
            </p>
          </div>
          <input
            className="input"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            style={{ fontSize: 22, textAlign: "center", fontFamily: "var(--font-display)" }}
          />
          {concept ? (
            <p className="muted center" style={{ margin: 0 }}>
              {concept.emoji} {concept.species}
            </p>
          ) : null}
          <div className="grow" />
          <div className="row">
            {step > 0 && concepts.length > 0 ? (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                {t("common.back")}
              </button>
            ) : null}
            <button
              className="btn grow"
              disabled={!name.trim()}
              onClick={() => setStep(step + 1)}
            >
              {t("common.continue")}
            </button>
          </div>
        </section>
      )}

      {stepIndex === 2 && (
        <section className="stack" style={{ flex: 1, gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{t("character.stepAvatar")}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {t("character.stepAvatarHint")}
            </p>
          </div>

          <div className="center" style={{ gap: 10 }}>
            <div className="avatar-stage">
              <AvatarBadge avatar={avatar} size={128} />
              <button
                type="button"
                className="shuffle-btn"
                aria-label={t("character.surprise")}
                onClick={() => setSprite(randomSprite())}
              >
                🎲
              </button>
            </div>
            <div className="swatch-row">
              {Object.entries(avatarColors).map(([token, hex]) => (
                <button
                  key={token}
                  type="button"
                  aria-label={token}
                  className={`swatch${color === token ? " selected" : ""}`}
                  style={{ background: hex }}
                  onClick={() => setColor(token)}
                />
              ))}
            </div>
          </div>

          <div className="look-tabs">
            {LOOK_TABS.map((lt) => (
              <button
                key={lt.id}
                type="button"
                className={`chip${tab === lt.id ? " selected" : ""}`}
                onClick={() => setTab(lt.id)}
              >
                <span aria-hidden>{lt.emoji}</span> {t(`character.tab_${lt.id}`)}
              </button>
            ))}
          </div>

          <div className="look-panel stack" style={{ gap: 12 }}>
            {tab === "skin" && (
              <ColorSwatches
                colors={SPRITE_SKIN_COLORS}
                value={sprite.skinColor}
                onPick={(hex) => set({ skinColor: hex })}
              />
            )}

            {tab === "hair" && (
              <>
                <div className="sprite-grid">
                  {["", ...SPRITE_HAIR, ...SPRITE_HATS].map((top) => (
                    <button
                      key={top || "bald"}
                      type="button"
                      className={`sprite-tile zoom-head${sprite.top === top ? " selected" : ""}`}
                      onClick={() => set({ top })}
                    >
                      {top === "" ? (
                        <span className="sprite-none">🥚</span>
                      ) : (
                        <SpriteImg sprite={{ ...sprite, top }} size={132} />
                      )}
                    </button>
                  ))}
                </div>
                {sprite.top !== "" && (
                  <ColorSwatches
                    colors={isSpriteHat(sprite.top) ? SPRITE_FABRIC_COLORS : SPRITE_HAIR_COLORS}
                    value={isSpriteHat(sprite.top) ? sprite.hatColor : sprite.hairColor}
                    onPick={(hex) =>
                      set(isSpriteHat(sprite.top) ? { hatColor: hex } : { hairColor: hex })
                    }
                  />
                )}
              </>
            )}

            {tab === "outfit" && (
              <>
                <div className="sprite-grid">
                  {SPRITE_CLOTHING.map((clothing) => (
                    <button
                      key={clothing}
                      type="button"
                      className={`sprite-tile${sprite.clothing === clothing ? " selected" : ""}`}
                      onClick={() => set({ clothing })}
                    >
                      <SpriteImg sprite={{ ...sprite, clothing }} size={66} />
                    </button>
                  ))}
                </div>
                <ColorSwatches
                  colors={SPRITE_FABRIC_COLORS}
                  value={sprite.clothesColor}
                  onPick={(hex) => set({ clothesColor: hex })}
                />
              </>
            )}

            {tab === "face" && (
              <>
                <div className="muted look-label">{t("character.eyes")}</div>
                <div className="sprite-grid">
                  {SPRITE_EYES.map((eyes) => (
                    <button
                      key={eyes}
                      type="button"
                      className={`sprite-tile zoom-face${sprite.eyes === eyes ? " selected" : ""}`}
                      onClick={() => set({ eyes })}
                    >
                      <SpriteImg sprite={{ ...sprite, eyes }} size={132} />
                    </button>
                  ))}
                </div>
                <div className="muted look-label">{t("character.mouth")}</div>
                <div className="sprite-grid">
                  {SPRITE_MOUTHS.map((mouth) => (
                    <button
                      key={mouth}
                      type="button"
                      className={`sprite-tile zoom-face${sprite.mouth === mouth ? " selected" : ""}`}
                      onClick={() => set({ mouth })}
                    >
                      <SpriteImg sprite={{ ...sprite, mouth }} size={132} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === "extras" && (
              <>
                <div className="muted look-label">{t("character.glasses")}</div>
                <div className="sprite-grid">
                  {["", ...SPRITE_ACCESSORIES].map((accessory) => (
                    <button
                      key={accessory || "none"}
                      type="button"
                      className={`sprite-tile zoom-face${sprite.accessory === accessory ? " selected" : ""}`}
                      onClick={() => set({ accessory })}
                    >
                      {accessory === "" ? (
                        <span className="sprite-none">✖️</span>
                      ) : (
                        <SpriteImg sprite={{ ...sprite, accessory }} size={132} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="muted look-label">{t("character.beard")}</div>
                <div className="sprite-grid">
                  {["", ...SPRITE_FACIAL_HAIR].map((facialHair) => (
                    <button
                      key={facialHair || "none"}
                      type="button"
                      className={`sprite-tile zoom-face${sprite.facialHair === facialHair ? " selected" : ""}`}
                      onClick={() => set({ facialHair })}
                    >
                      {facialHair === "" ? (
                        <span className="sprite-none">✖️</span>
                      ) : (
                        <SpriteImg sprite={{ ...sprite, facialHair }} size={132} />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="grow" />
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </button>
            <button className="btn grow" onClick={() => setStep(step + 1)}>
              {t("common.continue")}
            </button>
          </div>
        </section>
      )}

      {stepIndex === 3 && (
        <section className="stack" style={{ flex: 1 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{t("character.stepStats")}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {t("character.stepStatsHint", { points: STAT_POOL })}
            </p>
          </div>

          <div
            className="center card"
            style={{
              padding: 10,
              fontFamily: "var(--font-display)",
              fontSize: 17,
              background: left === 0 ? "var(--meadow-glow, #C0E5A2)" : undefined,
            }}
          >
            {left > 0 ? t("character.pointsLeft", { count: left }) : personality(stats)}
          </div>

          <div className="stack" style={{ gap: 10 }}>
            {STATS.map((stat) => (
              <div className="stat-row" key={stat}>
                <span style={{ fontSize: 22 }} aria-hidden>
                  {statMeta[stat].emoji}
                </span>
                <span className="stat-name">{t(`character.stat_${stat}`)}</span>
                <button
                  type="button"
                  className="stat-btn"
                  onClick={() => bump(stat, -1)}
                  disabled={stats[stat] === 0}
                  aria-label={`decrease ${stat}`}
                >
                  −
                </button>
                <div
                  className="stat-dots"
                  style={{ "--stat-color": statMeta[stat].color } as React.CSSProperties}
                >
                  {Array.from({ length: 4 }, (_, i) => (
                    <span key={i} className={`stat-dot${i < stats[stat] ? " filled" : ""}`} />
                  ))}
                </div>
                <button
                  type="button"
                  className="stat-btn"
                  onClick={() => bump(stat, 1)}
                  disabled={stats[stat] === 4 || left === 0}
                  aria-label={`increase ${stat}`}
                >
                  +
                </button>
              </div>
            ))}
          </div>

          <div className="grow" />
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </button>
            <button
              className="btn grow"
              disabled={!statsValid || !name.trim()}
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  species: concept?.species ?? "Adventurer",
                  conceptId: concept?.id,
                  avatar,
                  stats,
                })
              }
            >
              {t("character.ready")} 🎉
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
