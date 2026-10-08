import type { SessionInfo } from './types';

import { SrsError } from './errors';
import { negotiateSession, prepareUrl } from './utils';

export interface SrsRtcPublisher {
  publish(url: string): Promise<SessionInfo>;
  close(): void;
  ontrack?: (event: RTCTrackEvent) => void;
  stream: MediaStream;
  pc: null | RTCPeerConnection;
  constraints?: MediaStreamConstraints;
}

class SrsRtcPublisherAsyncImpl implements SrsRtcPublisher {
  constraints: MediaStreamConstraints = {
    audio: true,
    video: { width: { ideal: 320, max: 576 } },
  };
  ontrack?: (event: RTCTrackEvent) => void;
  pc: null | RTCPeerConnection = null;
  stream: MediaStream = new MediaStream();

  close(): void {
    this.stream.getTracks().forEach((t) => t.stop());
    this.stream = new MediaStream();
    this.pc?.close();
    this.pc = null;
  }

  async publish(url: string): Promise<SessionInfo> {
    const pc = this.ensurePc();

    // prepareUrl 只调用一次
    const { apiUrl, streamUrl, tid, schema, urlObject, port } = prepareUrl(
      url,
      '/rtc/v1/publish/',
    );

    if (
      !navigator.mediaDevices &&
      location.protocol === 'http:' &&
      location.hostname !== 'localhost'
    ) {
      throw new SrsError(
        'HttpsRequiredError',
        'Please use HTTPS or localhost to publish, see https://github.com/ossrs/srs/issues/2762#issuecomment-983147576',
      );
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia(
      this.constraints,
    );
    this.stream = mediaStream;

    const session = await negotiateSession(
      pc,
      apiUrl,
      streamUrl,
      tid,
      [
        { kind: 'audio', direction: 'sendonly' },
        { kind: 'video', direction: 'sendonly' },
      ],
      mediaStream,
    );

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

export function SrsRtcPublisherAsync(): SrsRtcPublisher {
  return new SrsRtcPublisherAsyncImpl();
}
