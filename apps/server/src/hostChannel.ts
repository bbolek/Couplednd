import { createHash, timingSafeEqual } from "node:crypto";
import { DMError } from "@familyquest/engine";
import type { HttpRequest, WsConnection } from "@familyquest/server-core";
import {
  buildJoinUrl,
  parseHostClientMessage,
  serializeHostServerMessage,
  type HostClientMessage,
  type HostServerMessage,
} from "@familyquest/shared";
import type { GameManager, GameRecord } from "./games.js";

export interface HostChannelDeps {
  games: GameManager;
  hostKey: string;
  /** e.g. "http://203.0.113.7" — PUBLIC_ORIGIN or derived from the Host header. */
  publicOrigin: string | null;
}

/** Compare secrets without leaking length or prefix timing. */
function secretsMatch(presented: string, expected: string): boolean {
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * One `/host` WebSocket = the host app remote-controlling one game. The first
 * message must authenticate with the shared passcode and either create a game
 * or reattach to a running one; after that the connection streams state,
 * narration, usage, and DM errors back to the app.
 */
export function attachHostChannel(ws: WsConnection, req: HttpRequest, deps: HostChannelDeps): void {
  let record: GameRecord | null = null;

  const origin = deps.publicOrigin ?? `http://${req.headers["host"] ?? "localhost"}`;

  const send = (msg: HostServerMessage): void => {
    ws.sendText(serializeHostServerMessage(msg));
  };
  const fail = (code: "BAD_HOST_KEY" | "GAME_NOT_FOUND" | "BAD_TOKEN" | "SERVER_FULL" | "NO_GAME" | "INVALID_MESSAGE", message: string, close = false): void => {
    send({ type: "error", code, message });
    if (close) ws.close(1008);
  };

  const bind = (target: GameRecord): void => {
    record = target;
    target.hostSink = {
      onState: (state) => send({ type: "state", state }),
      onNarration: (messageId, text, done) => send({ type: "narration", messageId, text, done }),
      onUsage: (totals) => send({ type: "usage", totals }),
      onDmError: (kind) => send({ type: "dmError", kind }),
    };
    // A DM error that fired while no host was attached would otherwise be
    // lost forever — replay it so the host app can offer a retry.
    if (target.lastDmError) send({ type: "dmError", kind: target.lastDmError });
  };

  ws.onClose(() => {
    // The game keeps running; a reattach may already have replaced the sink.
    if (record && record.hostSink && record === deps.games.get(record.gameId)) {
      record.hostSink = null;
    }
  });

  ws.onMessage((raw) => {
    const msg = parseHostClientMessage(raw);
    if (!msg) {
      fail("INVALID_MESSAGE", "Could not understand that message.");
      return;
    }
    handle(msg);
  });

  function handle(msg: HostClientMessage): void {
    switch (msg.type) {
      case "ping":
        send({ type: "pong" });
        return;

      case "host:create": {
        if (!secretsMatch(msg.hostKey, deps.hostKey)) {
          fail("BAD_HOST_KEY", "Wrong server passcode.", true);
          return;
        }
        if (record) {
          fail("INVALID_MESSAGE", "This connection already controls a game.");
          return;
        }
        const created = deps.games.create({
          shows: msg.shows,
          audience: msg.audience,
          language: msg.language,
          model: msg.model,
        });
        if (!created) {
          fail("SERVER_FULL", "The server is hosting too many adventures right now.", true);
          return;
        }
        bind(created);
        send({
          type: "host:created",
          gameId: created.gameId,
          joinUrl: buildJoinUrl(origin, created.gameId),
          hostToken: created.hostToken,
        });
        send({ type: "state", state: created.session.getState() });
        console.log(`[host] game ${created.gameId} created (${msg.shows.join(" × ")}, ${msg.model})`);

        // World building runs in the background; the app watches state for
        // concepts. Failure here means the game never got off the ground.
        void created.session.prepareWorld().catch((err) => {
          created.hostSink?.onDmError(err instanceof DMError ? err.kind : "unknown");
          console.error(`[host] world build failed for ${created.gameId}:`, err);
          deps.games.end(created.gameId);
        });
        return;
      }

      case "host:reattach": {
        if (!secretsMatch(msg.hostKey, deps.hostKey)) {
          fail("BAD_HOST_KEY", "Wrong server passcode.", true);
          return;
        }
        const existing = deps.games.get(msg.gameId);
        if (!existing) {
          fail("GAME_NOT_FOUND", "That adventure is no longer running.", true);
          return;
        }
        if (!secretsMatch(msg.hostToken, existing.hostToken)) {
          fail("BAD_TOKEN", "That host token doesn't match.", true);
          return;
        }
        bind(existing);
        deps.games.touch(existing);
        send({
          type: "host:reattached",
          gameId: existing.gameId,
          joinUrl: buildJoinUrl(origin, existing.gameId),
          hostPlayerId: existing.hostPlayerId,
        });
        send({ type: "state", state: existing.session.getState() });
        return;
      }

      case "host:character": {
        if (!record) {
          fail("NO_GAME", "Create or reattach to a game first.");
          return;
        }
        if (record.hostPlayerId && record.session.getState().characters[record.hostPlayerId]) {
          fail("INVALID_MESSAGE", "The host already has a character.");
          return;
        }
        if (!record.hostPlayerId) {
          const hostName = record.session.getState().language === "tr" ? "Ev sahibi" : "Host";
          record.hostPlayerId = record.session.addHostPlayer(hostName);
        }
        record.session.createCharacterFor(record.hostPlayerId, {
          name: msg.name,
          species: msg.species,
          avatar: msg.avatar,
          stats: msg.stats,
        });
        send({ type: "host:player", playerId: record.hostPlayerId });
        return;
      }

      case "host:start": {
        if (!record) {
          fail("NO_GAME", "Create or reattach to a game first.");
          return;
        }
        console.log(`[host] game ${record.gameId} start requested`);
        void record.session.startAdventure();
        return;
      }

      case "host:nudge": {
        if (!record) {
          fail("NO_GAME", "Create or reattach to a game first.");
          return;
        }
        console.log(`[host] game ${record.gameId} nudge requested`);
        void record.session.nudge(
          msg.instruction ?? "Please move the story along to something new and engaging.",
        );
        return;
      }

      case "host:end": {
        if (!record) {
          fail("NO_GAME", "Create or reattach to a game first.");
          return;
        }
        console.log(`[host] game ${record.gameId} ended by host`);
        deps.games.end(record.gameId);
        record = null;
        ws.close(1000);
        return;
      }
    }
  }
}
