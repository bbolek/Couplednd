import { t } from "../i18n.js";
import { usePlayerStore } from "../state/playerStore.js";
import { AvatarBadge } from "../components/bits.js";

/** Shown in the lobby before the adventure starts (or after creating a character). */
export function WaitingScreen({ subtitle }: { subtitle?: string }) {
  const game = usePlayerStore((s) => s.game);
  const players = game ? Object.values(game.players) : [];
  const characters = game?.characters ?? {};

  return (
    <div className="screen" style={{ gap: 24 }}>
      <div className="center" style={{ gap: 8, paddingTop: 32 }}>
        <div className="wiggle" style={{ fontSize: 46 }} aria-hidden>
          🏕️
        </div>
        <h1 className="title">{t("lobby.title")}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {subtitle ?? t("lobby.waitingForCharacters")}
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {players.map((p) => {
          const c = characters[p.playerId];
          return (
            <div key={p.playerId} className="row card" style={{ padding: 12 }}>
              {c ? (
                <AvatarBadge avatar={c.avatar} size={44} />
              ) : (
                <span
                  className="avatar-badge"
                  style={{ width: 44, height: 44, fontSize: 22, background: "var(--border)" }}
                >
                  ⏳
                </span>
              )}
              <div className="grow">
                <div style={{ fontWeight: 800 }}>
                  {p.name}
                  {p.isHost ? (
                    <span className="muted" style={{ fontSize: 12 }}>
                      {" "}
                      · {t("table.hostBadge")}
                    </span>
                  ) : null}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {c ? `${c.name} — ${c.species}` : t("common.loading")}
                </div>
              </div>
              {p.connection === "offline" ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  💤 {t("table.offline")}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
