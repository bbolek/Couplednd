import { useState } from "react";
import { t } from "../i18n.js";
import { usePlayerStore } from "../state/playerStore.js";

export function JoinScreen({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState("");
  const error = usePlayerStore((s) => s.error);

  const errorText =
    error === "GAME_FULL"
      ? t("join.gameFull")
      : error === "GAME_NOT_FOUND"
        ? t("join.gameNotFound")
        : null;

  return (
    <div className="screen center" style={{ gap: 24, justifyContent: "center" }}>
      <div className="bounce" aria-hidden>
        🎲
      </div>
      <div className="stack" style={{ gap: 6, alignItems: "center" }}>
        <h1 className="title-hero">{t("app.name")}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t("app.tagline")}
        </p>
      </div>

      <form
        className="stack"
        style={{ width: "100%", maxWidth: 340 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onJoin(name.trim());
        }}
      >
        <label className="stack" style={{ gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
            {t("join.namePrompt")}
          </span>
          <input
            className="input"
            value={name}
            maxLength={24}
            placeholder={t("join.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        {errorText ? (
          <p style={{ color: "var(--coral-deep)", margin: 0, fontWeight: 600 }}>{errorText}</p>
        ) : null}
        <button className="btn" type="submit" disabled={!name.trim()}>
          {t("join.join")} ✨
        </button>
      </form>
    </div>
  );
}
