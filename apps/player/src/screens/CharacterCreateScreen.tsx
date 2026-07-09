import { useMemo, useState } from "react";
import {
  avatarColors,
  isValidAllocation,
  STAT_POOL,
  STATS,
  statMeta,
  type Avatar,
  type CharacterConcept,
  type StatName,
  type Stats,
} from "@familyquest/shared";
import { t } from "../i18n.js";
import { usePlayerStore } from "../state/playerStore.js";
import { AvatarBadge } from "../components/bits.js";

const FACE_EMOJI = [
  "🦊", "🐶", "🐱", "🐰", "🐻", "🐼", "🦁", "🐸",
  "🦄", "🐲", "🤖", "🧚", "🦉", "🐙", "🐨", "👾",
];
const ACCESSORIES = ["", "🎩", "👑", "🎀", "🕶️", "⚔️", "🪄", "🌸"];

export interface CharacterDraft {
  name: string;
  species: string;
  conceptId?: string;
  avatar: Avatar;
  stats: Stats;
}

const EMPTY_STATS: Stats = { brave: 2, smart: 2, charm: 2, sneaky: 2 };

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

export function CharacterCreateScreen({
  onSubmit,
}: {
  onSubmit: (draft: CharacterDraft) => void;
}) {
  const concepts = usePlayerStore((s) => s.game?.setup.concepts ?? []);
  const [step, setStep] = useState(0);
  const [concept, setConcept] = useState<CharacterConcept | null>(null);
  const [name, setName] = useState("");
  const [face, setFace] = useState(FACE_EMOJI[0]!);
  const [color, setColor] = useState<string>("sunshine");
  const [accessory, setAccessory] = useState("");
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
    if (c.emoji && FACE_EMOJI.includes(c.emoji)) setFace(c.emoji);
    setStep(1);
  }

  function bump(stat: StatName, delta: 1 | -1) {
    const next = { ...stats, [stat]: stats[stat] + delta };
    if (next[stat] < 0 || next[stat] > 4) return;
    const total = STATS.reduce((sum, s) => sum + next[s], 0);
    if (total > STAT_POOL) return;
    setStats(next);
  }

  const avatar: Avatar = { emoji: face, color, ...(accessory ? { accessory } : {}) };

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
        <section className="stack" style={{ flex: 1 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{t("character.stepAvatar")}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {t("character.stepAvatarHint")}
            </p>
          </div>

          <div className="center" style={{ padding: 8 }}>
            <AvatarBadge avatar={avatar} size={96} />
          </div>

          <div className="row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {FACE_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className={`chip${face === e ? " selected" : ""}`}
                style={{ fontSize: 22, padding: "6px 10px" }}
                onClick={() => setFace(e)}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="row" style={{ gap: 10, justifyContent: "center" }}>
            {Object.entries(avatarColors).map(([token, hex]) => (
              <button
                key={token}
                type="button"
                aria-label={token}
                onClick={() => setColor(token)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: hex,
                  border:
                    color === token ? "3px solid var(--text)" : "3px solid transparent",
                  cursor: "pointer",
                  transform: color === token ? "scale(1.2)" : undefined,
                  transition: "transform 120ms",
                }}
              />
            ))}
          </div>

          <div className="row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {ACCESSORIES.map((a) => (
              <button
                key={a || "none"}
                type="button"
                className={`chip${accessory === a ? " selected" : ""}`}
                style={{ fontSize: 20, padding: "6px 10px" }}
                onClick={() => setAccessory(a)}
              >
                {a || "✖️"}
              </button>
            ))}
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
