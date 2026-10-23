import type { SessionInfo } from './types';

import { SrsError } from './errors';
import { extractWhipSessionId, postSDPPlain } from './utils';

export interface SrsRtcWhipWhep {
  publish(url: string): Promise<SessionInfo>;
  play(url: string): Promise<SessionInfo>;
  close(): void;
  ontrack?: (event: RTCTrackEvent) => void;
  stream: MediaStream;
  pc: null | RTCPeerConnection;
  constraints?: MediaStreamConstraints;
}

function getSdpOrThrow(desc: null | RTCSessionDescriptionInit): string {
  if (!desc?.sdp) {
    throw new SrsError('InvalidSdp', 'SDP is empty');
  }
  return desc.sdp;
}

class SrsRtcWhipWhepAsyncImpl implements SrsRtcWhipWhep {
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

  async play(url: string): Promise<SessionInfo> {
    if (!url.includes('/whip-play/') && !url.includes('/whep/')) {
      throw new SrsError('InvalidUrl', `Invalid WHEP url: ${url}`);
    }
    const pc = this.ensurePc();

    // 严格对齐官方 SDK：WHEP 默认只拉取 video
    pc.addTransceiver('video', { direction: 'recvonly' });

    return this.negotiateWhipWhep(url, pc);
  }

  async publish(url: string): Promise<SessionInfo> {
    if (!url.includes('/whip/')) {
      throw new SrsError('InvalidUrl', `Invalid WHIP url: ${url}`);
    }
    const pc = this.ensurePc();

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

    pc.getSenders().forEach((s) => {
      if (s.track) s.replaceTrack(null);
    });

    const mediaStream = await navigator.mediaDevices.getUserMedia(
      this.constraints,
    );
    this.stream = mediaStream;

    mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream));

    return this.negotiateWhipWhep(url, pc);
  }

  private ensurePc(): RTCPeerConnection {
    if (!this.pc) {
      this.pc = new RTCPeerConnection();

      this.pc.ontrack = (event) => {
        if (!this.stream.getTracks().includes(event.track)) {
          this.stream.addTrack(event.track);
        }
        this.ontrack?.(event);
      };
    }
    return this.pc;
  }

  /**
   * 提取公共的 WHIP/WHEP 协商逻辑
   */
  private async negotiateWhipWhep(
    url: string,
    pc: RTCPeerConnection,
  ): Promise<SessionInfo> {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const offerSdp = getSdpOrThrow(offer);

    const answer = await postSDPPlain(url, offerSdp);
    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: answer }),
    );

    const sessionid = extractWhipSessionId(offerSdp, answer);
    const a = document.createElement('a');
    a.href = url;

    return { sessionid, simulator: `${a.protocol}//${a.host}/rtc/v1/nack/` };
  }
}

export function SrsRtcWhipWhepAsync(): SrsRtcWhipWhep {
  return new SrsRtcWhipWhepAsyncImpl();
}
