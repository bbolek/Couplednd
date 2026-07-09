import type { Transport, TransportServer, TransportSocket } from "../transport.js";

/**
 * react-native-tcp-socket transport. The module is injected by the host app
 * (`createRnTcpTransport(require("react-native-tcp-socket").default)`) so
 * this package carries no native dependency and stays testable on Node.
 *
 * Shapes below mirror the react-native-tcp-socket v6 API surface we use.
 */

interface RnSocket {
  write(data: Uint8Array | string): void;
  end(): void;
  destroy(): void;
  on(event: "data", cb: (data: unknown) => void): void;
  on(event: "close", cb: () => void): void;
  on(event: "error", cb: (err: unknown) => void): void;
  setNoDelay?(noDelay: boolean): void;
}

interface RnServer {
  listen(options: { port: number; host: string }, cb?: () => void): void;
  close(cb?: () => void): void;
  on(event: "error", cb: (err: unknown) => void): void;
}

export interface RnTcpModule {
  createServer(handler: (socket: RnSocket) => void): RnServer;
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof data === "string") return new TextEncoder().encode(data);
  // Buffer-like objects from the native bridge
  if (data && typeof data === "object" && "buffer" in (data as object)) {
    const view = data as { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number };
    return new Uint8Array(view.buffer, view.byteOffset ?? 0, view.byteLength);
  }
  throw new Error("rn-tcp: unsupported data type from socket");
}

function wrap(socket: RnSocket): TransportSocket {
  socket.setNoDelay?.(true);
  return {
    write: (data) => socket.write(data),
    end: () => socket.end(),
    destroy: () => socket.destroy(),
    onData: (cb) => socket.on("data", (data) => cb(toBytes(data))),
    onClose: (cb) => socket.on("close", cb),
    onError: (cb) => socket.on("error", cb),
  };
}

export function createRnTcpTransport(tcpModule: RnTcpModule): Transport {
  return {
    listen(port, host, onConnection): Promise<TransportServer> {
      return new Promise((resolve, reject) => {
        const server = tcpModule.createServer((socket) => onConnection(wrap(socket)));
        server.on("error", reject);
        server.listen({ port, host }, () => {
          resolve({
            close: () =>
              new Promise<void>((done) => {
                server.close(() => done());
              }),
          });
        });
      });
    },
  };
}
