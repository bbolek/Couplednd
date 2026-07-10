import { createServer, type Socket } from "node:net";
import type { Transport, TransportServer, TransportSocket } from "../transport.js";

function wrap(socket: Socket): TransportSocket {
  return {
    write: (data) => {
      socket.write(data);
    },
    end: () => socket.end(),
    destroy: () => socket.destroy(),
    onData: (cb) => {
      socket.on("data", (chunk: Buffer) =>
        cb(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
      );
    },
    onClose: (cb) => {
      socket.on("close", cb);
    },
    onError: (cb) => {
      socket.on("error", cb);
    },
  };
}

/** Node `net` transport — used by devhost, integration tests, and CI. */
export const nodeTransport: Transport = {
  listen(port, host, onConnection): Promise<TransportServer> {
    return new Promise((resolve, reject) => {
      const live = new Set<Socket>();
      const server = createServer((socket) => {
        socket.setNoDelay(true);
        live.add(socket);
        socket.on("close", () => live.delete(socket));
        onConnection(wrap(socket));
      });
      server.once("error", reject);
      server.listen(port, host, () => {
        resolve({
          close: () =>
            new Promise<void>((done) => {
              // net.Server.close only stops listening; drop live
              // connections too so shutdown is deterministic.
              server.close(() => done());
              for (const socket of live) socket.destroy();
            }),
        });
      });
    });
  },
};
