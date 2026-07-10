import { useEffect, useRef, useState } from "react";
import { t } from "../i18n.js";
import { usePlayerStore } from "../state/playerStore.js";
import { CharacterStrip } from "../components/bits.js";

const TYPE_TICK_MS = 33;

/** Smooth the API's bursty stream chunks into a steady typewriter reveal. */
function useTypewriter(text: string, done: boolean): string {
  const [shown, setShown] = useState(() => (done ? text.length : 0));
  const targetRef = useRef(text.length);
  targetRef.current = text.length;
  const settled = done && shown >= text.length;

  useEffect(() => {
    if (settled) return;
    const id = setInterval(() => {
      setShown((s) => {
        const target = targetRef.current;
        if (s >= target) return s;
        const backlog = target - s;
        return Math.min(target, s + Math.max(1, Math.ceil(backlog / 24)));
      });
    }, TYPE_TICK_MS);
    return () => clearInterval(id);
  }, [settled]);

  return text.slice(0, shown);
}

function NarrationBeat({ text, done }: { text: string; done: boolean }) {
  const shown = useTypewriter(text, done);
  const streaming = !done || shown.length < text.length;
  return (
    <div className="beat">
      {shown}
      {streaming ? <span className="cursor" /> : null}
    </div>
  );
}

export function PlayScreen({ onAction }: { onAction: (freeText: string) => void }) {
  const game = usePlayerStore((s) => s.game);
  const beats = usePlayerStore((s) => s.beats);
  const playerId = usePlayerStore((s) => s.playerId);
  const dmError = usePlayerStore((s) => s.dmError);
  const [text, setText] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const me = playerId ? game?.characters[playerId] : undefined;
  const waitingRoll = game ? Object.values(game.pending.rolls)[0] : undefined;
  const waitingTask = game ? Object.values(game.pending.tasks)[0] : undefined;
  const waitingOn = waitingRoll ?? waitingTask;
  const waitingName = waitingOn ? game?.players[waitingOn.playerId]?.name : undefined;
  const streaming = beats.some((b) => !b.done);
  const openFloor = !waitingOn && !streaming && game?.phase === "playing";

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [beats]);

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAction(trimmed);
    setText("");
  }

  return (
    <div className="screen" style={{ gap: 12, height: "100dvh" }}>
      {me ? <CharacterStrip character={me} /> : null}

      <div ref={feedRef} className="narration grow" style={{ overflowY: "auto", minHeight: 0 }}>
        {beats.length === 0 ? (
          <p className="muted center" style={{ paddingTop: 40 }}>
            🔮 {t("play.yourTurnSoon")}
          </p>
        ) : (
          beats.map((b) => <NarrationBeat key={b.messageId} text={b.text} done={b.done} />)
        )}
      </div>

      {dmError ? (
        <p className="muted center" style={{ margin: 0, fontFamily: "var(--font-display)" }}>
          🌩️ {t("play.dmError")}
        </p>
      ) : null}

      {waitingName && waitingOn?.playerId !== playerId ? (
        <p className="muted center" style={{ margin: 0, fontFamily: "var(--font-display)" }}>
          ⏳ {t("play.waitingOn", { name: waitingName })}
        </p>
      ) : null}

      {streaming ? (
        <p className="muted center" style={{ margin: 0, fontFamily: "var(--font-display)" }}>
          🪄 {t("play.dmThinking")}
        </p>
      ) : null}

      {openFloor ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {[t("play.suggestion1"), t("play.suggestion2"), t("play.suggestion3")].map((s) => (
              <button key={s} type="button" className="chip" onClick={() => onAction(s)}>
                {s}
              </button>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="input grow"
              value={text}
              maxLength={280}
              placeholder={t("play.actionPlaceholder")}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn" type="submit" disabled={!text.trim()} style={{ minHeight: 52 }}>
              {t("play.send")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
