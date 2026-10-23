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
    console.warn('[SrsRtcPlayer][Debug] 开始执行 play, url:', url);
    const pc = this.ensurePc();

    const { apiUrl, streamUrl, tid, schema, urlObject, port } = prepareUrl(
      url,
      '/rtc/v1/play/',
    );

    console.warn('[SrsRtcPlayer][Debug] prepareUrl 解析结果 apiUrl:', apiUrl);
    console.warn('[SrsRtcPlayer][Debug] streamUrl:', streamUrl);
    console.warn('[SrsRtcPlayer][Debug] tid:', tid);

    const session = await negotiateSession(pc, apiUrl, streamUrl, tid, [
      { kind: 'audio', direction: 'recvonly' },
      { kind: 'video', direction: 'recvonly' },
    ]);

    console.warn('[SrsRtcPlayer][Debug] negotiateSession 完成, 获取到 SDP');
    session.simulator = `${schema}//${urlObject.server}:${port}/rtc/v1/nack/`;
    return session;
  }

  private ensurePc(): RTCPeerConnection {
    if (!this.pc) {
      this.pc = new RTCPeerConnection();

      // 完美复刻 srs.sdk.js 官方逻辑
      this.pc.ontrack = (event) => {
        if (!this.stream.getTracks().includes(event.track)) {
          this.stream.addTrack(event.track);
        }
        this.ontrack?.(event);
      };
    }
    return this.pc;
  }
}

export function SrsRtcPlayerAsync(): SrsRtcPlayer {
  return new SrsRtcPlayerAsyncImpl();
}
