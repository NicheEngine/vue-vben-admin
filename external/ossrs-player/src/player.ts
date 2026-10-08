import type { SessionInfo } from './types';

import { negotiateSession, prepareUrl } from './utils';

export interface SrsRtcPlayer {
  play(url: string): Promise<SessionInfo>;
  close(): void;
  ontrack?: (event: RTCTrackEvent) => void;
  stream: MediaStream;
  pc: null | RTCPeerConnection;
}

class SrsRtcPlayerAsyncImpl implements SrsRtcPlayer {
  ontrack?: (event: RTCTrackEvent) => void;
  pc: null | RTCPeerConnection = null;
  stream: MediaStream = new MediaStream();

  close(): void {
    this.stream.getTracks().forEach((t) => t.stop());
    this.stream = new MediaStream();
    this.pc?.close();
    this.pc = null;
  }

  async play(url: string): Promise<SessionInfo> {
    const pc = this.ensurePc();

    const { apiUrl, streamUrl, tid, schema, urlObject, port } = prepareUrl(
      url,
      '/rtc/v1/play/',
    );

    const session = await negotiateSession(pc, apiUrl, streamUrl, tid, [
      { kind: 'audio', direction: 'recvonly' },
      { kind: 'video', direction: 'recvonly' },
    ]);

    session.simulator = `${schema}//${urlObject.server}:${port}/rtc/v1/nack/`;
    return session;
  }

  private ensurePc(): RTCPeerConnection {
    if (!this.pc) {
      this.pc = new RTCPeerConnection();
      this.pc.ontrack = (event) => this.ontrack?.(event);
    }
    return this.pc;
  }
}

export function SrsRtcPlayerAsync(): SrsRtcPlayer {
  return new SrsRtcPlayerAsyncImpl();
}
