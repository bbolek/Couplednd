import { useEffect, useMemo, useRef } from "react";
import { usePlayerStore } from "./state/playerStore.js";
import { GameConnection, loadIdentity } from "./ws/connection.js";
import { t } from "./i18n.js";
import { JoinScreen } from "./screens/JoinScreen.js";
import { WaitingScreen } from "./screens/WaitingScreen.js";
import { CharacterCreateScreen, type CharacterDraft } from "./screens/CharacterCreateScreen.js";
import { PlayScreen } from "./screens/PlayScreen.js";
import { DiceRollScreen } from "./screens/DiceRollScreen.js";
import { TaskPromptScreen } from "./screens/TaskPromptScreen.js";

function gameIdFromUrl(): string {
  const params = new URLSearchParams(location.search);
  return params.get("g") ?? "dev";
}

export default function App() {
  const gameId = useMemo(gameIdFromUrl, []);
  const connection = useRef<GameConnection | null>(null);

  const status = usePlayerStore((s) => s.status);
  const playerId = usePlayerStore((s) => s.playerId);
  const game = usePlayerStore((s) => s.game);
  const myDiceRequest = usePlayerStore((s) => s.myDiceRequest);
  const lastRoll = usePlayerStore((s) => s.lastRoll);
  const clearLastRoll = usePlayerStore((s) => s.clearLastRoll);
  const myTask = usePlayerStore((s) => s.myTask);

  // Auto-reconnect on load when we already have an identity for this game.
  useEffect(() => {
    connection.current = new GameConnection(gameId);
    if (loadIdentity(gameId)) {
      connection.current.connect();
    }
    return () => connection.current?.close();
  }, [gameId]);

  const conn = () => connection.current!;

  // --- Screen routing ------------------------------------------------------

  if (!playerId || !game) {
    const reconnecting = status === "reconnecting" || (status === "connecting" && loadIdentity(gameId));
    if (reconnecting) {
      return (
        <div className="overlay">
          <div className="bounce">🧭</div>
          <h2>{t("join.reconnecting")}</h2>
        </div>
      );
    }
    return <JoinScreen onJoin={(name) => conn().connect(name)} />;
  }

  const me = game.characters[playerId];

  // Dice takeover: while a request for me is pending, or right after it
  // resolved (celebration until the player taps Continue).
  if (myDiceRequest || lastRoll) {
    const request = myDiceRequest ?? {
      requestId: "done",
      playerId,
      stat: "brave" as const,
      dc: 10,
      reason: "",
    };
    return (
      <>
        <DiceRollScreen
          request={request}
          result={lastRoll}
          onRoll={() =>
            myDiceRequest &&
            conn().send({ type: "dice:roll", requestId: myDiceRequest.requestId })
          }
          onDone={clearLastRoll}
        />
        <ReconnectOverlay />
      </>
    );
  }

  if (myTask) {
    return (
      <>
        <TaskPromptScreen
          task={myTask}
          onAnswer={(answer) =>
            conn().send({ type: "action:submit", taskId: myTask.taskId, ...answer })
          }
        />
        <ReconnectOverlay />
      </>
    );
  }

  if (!me) {
    if (game.phase === "lobby" || game.phase === "characterCreation") {
      return (
        <>
          <CharacterCreateScreen
            onSubmit={(draft: CharacterDraft) =>
              conn().send({ type: "character:create", ...draft })
            }
          />
          <ReconnectOverlay />
        </>
      );
    }
  }

  if (game.phase === "lobby" || game.phase === "characterCreation") {
    return (
      <>
        <WaitingScreen subtitle={me ? t("character.waitingOthers") : undefined} />
        <ReconnectOverlay />
      </>
    );
  }

  if (game.phase === "ended") {
    return (
      <div className="screen center" style={{ gap: 16, justifyContent: "center" }}>
        <div className="bounce">🏆</div>
        <h1 className="title">{t("recap.title")}</h1>
        <p className="muted">{game.scene?.summary}</p>
      </div>
    );
  }

  return (
    <>
      <PlayScreen onAction={(freeText) => conn().send({ type: "action:submit", freeText })} />
      <ReconnectOverlay />
    </>
  );
}

function ReconnectOverlay() {
  const status = usePlayerStore((s) => s.status);
  if (status === "online" || status === "connecting") return null;
  return (
    <div className="overlay">
      <div className="bounce">📡</div>
      <h2>{status === "failed" ? t("errors.network") : t("join.reconnecting")}</h2>
    </div>
  );
}
