import TcpSocket from "react-native-tcp-socket";
import * as Network from "expo-network";
import { createRnTcpTransport } from "@familyquest/server-core/rn-tcp";
import type { RunningServer } from "@familyquest/server-core";
import { DEFAULT_PORT } from "@familyquest/shared";
import { joinUrl, startGameServer, type GameSession } from "@familyquest/engine";
import { getEmbeddedAssets } from "./embeddedAssets";

export interface HostServerInfo {
  server: RunningServer;
  /** null when the LAN IP could not be determined (no WiFi?). */
  joinUrl: string | null;
  port: number;
}

/**
 * Boot the embedded HTTP+WS server for a session and figure out the LAN
 * address family members' phones should hit.
 */
export async function startHostServer(session: GameSession): Promise<HostServerInfo> {
  const transport = createRnTcpTransport(
    TcpSocket as unknown as Parameters<typeof createRnTcpTransport>[0],
  );

  const server = await startGameServer({
    transport,
    session,
    assets: getEmbeddedAssets(),
    port: DEFAULT_PORT,
    host: "0.0.0.0",
  });

  let url: string | null = null;
  try {
    const ip = await Network.getIpAddressAsync();
    if (ip && ip !== "0.0.0.0") {
      url = joinUrl(ip, DEFAULT_PORT, session.getState().gameId);
    }
  } catch {
    // Leave null; the lobby shows a "same WiFi?" hint instead of a QR.
  }

  return { server, joinUrl: url, port: DEFAULT_PORT };
}
