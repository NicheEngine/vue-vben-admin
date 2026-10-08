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

    // 同时加 audio + video，避免丢音频
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.addTransceiver('video', { direction: 'recvonly' });

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

    const mediaStream = await navigator.mediaDevices.getUserMedia(
      this.constraints,
    );
    this.stream = mediaStream;

    // 只 addTrack，让浏览器自动创建 sendonly transceiver
    mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream));

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

  private ensurePc(): RTCPeerConnection {
    if (!this.pc) {
      this.pc = new RTCPeerConnection();
      this.pc.ontrack = (event) => this.ontrack?.(event);
    }
    return this.pc;
  }
}

export function SrsRtcWhipWhepAsync(): SrsRtcWhipWhep {
  return new SrsRtcWhipWhepAsyncImpl();
}
