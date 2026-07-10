import {
  createClaudeDM,
  createMockDM,
  DMError,
  GameSession,
} from "@familyquest/engine";
import { generateToken } from "@familyquest/server-core";
import type {
  Audience,
  DMErrorKind,
  DMModel,
  GameState,
  Language,
  PlayerId,
  UsageTotals,
} from "@familyquest/shared";

/** The single host connection currently watching a game. Swapped on reattach. */
export interface HostSink {
  onState(state: GameState): void;
  onNarration(messageId: string, text: string, done: boolean): void;
  onUsage(totals: UsageTotals): void;
  onDmError(kind: DMErrorKind): void;
}

export interface GameRecord {
  gameId: string;
  /** Secret the host app holds to reattach after a disconnect. */
  hostToken: string;
  session: GameSession;
  hostPlayerId: PlayerId | null;
  hostSink: HostSink | null;
  /** Last DM error, kept so a re-attaching host still sees it. */
  lastDmError: DMErrorKind | null;
  lastActivityAt: number;
}

export interface GameManagerOptions {
  anthropicApiKey: string | null;
  mockDM: boolean;
  maxGames: number;
  gameTtlMs: number;
  /** Sweep cadence override for tests. */
  sweepMs?: number;
  /** Mock-DM streaming delay override for tests. */
  mockWordDelayMs?: number;
}

export interface CreateGameInput {
  shows: string[];
  audience: Audience;
  language: Language;
  model: DMModel;
}

/**
 * All running games on this server. Each game is one GameSession (exactly the
 * object that used to live on the host's phone); the host app drives it over
 * the /host WebSocket and players join over /ws?g=<gameId>.
 */
export class GameManager {
  private games = new Map<string, GameRecord>();
  private sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly options: GameManagerOptions) {
    this.sweeper = setInterval(() => this.sweep(), options.sweepMs ?? 10 * 60 * 1000);
    // Don't keep the process alive just to sweep.
    this.sweeper.unref?.();
  }

  get size(): number {
    return this.games.size;
  }

  get(gameId: string): GameRecord | undefined {
    return this.games.get(gameId);
  }

  /** Returns null when the server is at capacity. */
  create(input: CreateGameInput): GameRecord | null {
    if (this.games.size >= this.options.maxGames) return null;

    let gameId = randomGameId();
    while (this.games.has(gameId)) gameId = randomGameId();

    const record: GameRecord = {
      gameId,
      hostToken: generateToken(),
      session: null as unknown as GameSession, // assigned below, before any use
      hostPlayerId: null,
      hostSink: null,
      lastDmError: null,
      lastActivityAt: Date.now(),
    };

    const session: GameSession = new GameSession({
      gameId,
      language: input.language,
      shows: input.shows,
      audience: input.audience,
      onError: (err) => {
        const kind: DMErrorKind = err instanceof DMError ? err.kind : "unknown";
        console.error(`[dm] game ${gameId} DM error (${kind}):`, err);
        record.lastDmError = kind;
        record.hostSink?.onDmError(kind);
      },
      onNarration: (messageId, text, done) => {
        if (done) {
          record.lastDmError = null; // the DM recovered — stale error is noise
          console.log(`[dm] game ${gameId} narration ${messageId} complete`);
        }
        record.hostSink?.onNarration(messageId, text, done);
      },
      createDM: this.options.mockDM
        ? createMockDM({
            wordDelayMs: this.options.mockWordDelayMs,
            getPlayerIds: () =>
              Object.keys(session.getState().players).filter(
                (id) => session.getState().characters[id],
              ),
          })
        : createClaudeDM({
            apiKey: this.options.anthropicApiKey!,
            model: input.model,
            language: input.language,
            audience: input.audience,
            getParty: () =>
              Object.entries(session.getState().characters).map(([playerId, character]) => ({
                playerId,
                playerName: session.getState().players[playerId]?.name ?? "?",
                character,
              })),
            onUsage: (totals) => record.hostSink?.onUsage(totals),
          }),
    });
    record.session = session;

    session.subscribe((state) => {
      record.lastActivityAt = Date.now();
      record.hostSink?.onState(state);
    });

    this.games.set(gameId, record);
    return record;
  }

  touch(record: GameRecord): void {
    record.lastActivityAt = Date.now();
  }

  end(gameId: string): void {
    const record = this.games.get(gameId);
    if (!record) return;
    this.games.delete(gameId);
    record.hostSink = null;
    record.session.close();
  }

  closeAll(): void {
    for (const gameId of [...this.games.keys()]) this.end(gameId);
    clearInterval(this.sweeper);
  }

  private sweep(): void {
    const cutoff = Date.now() - this.options.gameTtlMs;
    for (const [gameId, record] of this.games) {
      if (record.lastActivityAt < cutoff) {
        console.log(`[games] closing idle game ${gameId}`);
        this.end(gameId);
      }
    }
  }
}

function randomGameId(): string {
  return Math.random().toString(36).slice(2, 8);
}
