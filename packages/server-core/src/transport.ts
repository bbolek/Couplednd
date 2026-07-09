/**
 * The seam that makes the whole server portable: everything above this
 * interface is plain TypeScript that runs identically on Node (dev, tests)
 * and React Native (react-native-tcp-socket). If this layer ever proves
 * insufficient on a platform, only the Transport implementation is swapped.
 */

export interface TransportSocket {
  write(data: Uint8Array): void;
  end(): void;
  destroy(): void;
  onData(cb: (chunk: Uint8Array) => void): void;
  onClose(cb: () => void): void;
  onError(cb: (err: unknown) => void): void;
}

export interface TransportServer {
  close(): Promise<void>;
}

export interface Transport {
  listen(
    port: number,
    host: string,
    onConnection: (socket: TransportSocket) => void,
  ): Promise<TransportServer>;
}
