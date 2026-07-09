import { useEffect, useRef, useState } from "react";
import { statMeta, type DiceRequest, type RollResult } from "@familyquest/shared";
import { t } from "../i18n.js";
import { D20Shape, SparkleBurst } from "../components/bits.js";

type Stage = "idle" | "tumbling" | "landed";

const OUTCOME_EMOJI: Record<RollResult["outcome"], string> = {
  critSuccess: "🌟",
  success: "✨",
  fail: "💨",
  fumble: "🫠",
};

/**
 * Full-screen dice moment. The player taps (or shakes); we tumble with fake
 * numbers until the authoritative result arrives from the host, then land
 * the die on the real number with a spring + sparkle burst.
 */
export function DiceRollScreen({
  request,
  result,
  onRoll,
  onDone,
}: {
  request: DiceRequest;
  result: RollResult | null;
  onRoll: () => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [shownFace, setShownFace] = useState<number | "?">("?");
  const tumbleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const statColor = statMeta[request.stat].color;
  const statLabel = t(`character.stat_${request.stat}`);

  function startRoll() {
    if (stage !== "idle") return;
    setStage("tumbling");
    onRoll();
    tumbleTimer.current = setInterval(() => {
      setShownFace(Math.floor(Math.random() * 20) + 1);
    }, 90);
    try {
      navigator.vibrate?.(30);
    } catch {
      /* unsupported */
    }
  }

  // Land when the authoritative result arrives (min. tumble time for drama).
  useEffect(() => {
    if (!result || stage === "landed") return;
    const minTumble = stage === "tumbling" ? 900 : 0;
    const timer = setTimeout(() => {
      if (tumbleTimer.current) clearInterval(tumbleTimer.current);
      setShownFace(result.raw);
      setStage("landed");
      try {
        navigator.vibrate?.(result.outcome === "critSuccess" ? [60, 40, 120] : 60);
      } catch {
        /* unsupported */
      }
    }, minTumble);
    return () => clearTimeout(timer);
  }, [result, stage]);

  // Shake-to-roll via DeviceMotion (iOS needs a user-gesture permission,
  // so the tap path always remains primary).
  useEffect(() => {
    if (stage !== "idle") return;
    let last = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const magnitude = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      const now = Date.now();
      if (magnitude > 38 && now - last > 800) {
        last = now;
        startRoll();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    return () => {
      if (tumbleTimer.current) clearInterval(tumbleTimer.current);
    };
  }, []);

  const good = result && (result.outcome === "success" || result.outcome === "critSuccess");

  return (
    <div className="screen d20-stage" style={{ position: "relative" }}>
      <div className="center" style={{ gap: 6 }}>
        <h1 className="title">
          {statMeta[request.stat].emoji} {t("dice.title", { stat: statLabel })}
        </h1>
        <p className="muted" style={{ margin: 0, maxWidth: 300 }}>
          {request.reason}
        </p>
      </div>

      <div style={{ position: "relative" }}>
        <D20Shape
          color={statColor}
          className={stage === "tumbling" ? "tumbling" : stage === "landed" ? "landed" : ""}
          onClick={startRoll}
        >
          {shownFace}
        </D20Shape>
        {stage === "landed" && good ? <SparkleBurst /> : null}
      </div>

      {stage === "idle" && (
        <p className="muted center" style={{ margin: 0 }}>
          {t("dice.tapToRoll")}
        </p>
      )}
      {stage === "tumbling" && (
        <p className="muted center" style={{ margin: 0 }}>
          {t("dice.rolling")}
        </p>
      )}

      {stage === "landed" && result ? (
        <div className="stack center" style={{ gap: 10 }}>
          <div className={`outcome-banner outcome-${result.outcome}`}>
            {OUTCOME_EMOJI[result.outcome]} {t(`dice.${result.outcome}`)}
          </div>
          <div className="muted" style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
            {t("dice.total", { raw: result.raw, bonus: result.bonus, total: result.total })}
          </div>
          <button className="btn" onClick={onDone} style={{ minWidth: 200 }}>
            {t("common.continue")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
