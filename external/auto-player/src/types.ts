export type PlayerEngine = 'easy' | 'jessibuca' | 'live' | 'none' | 'ossrs';

export interface AutoPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: null | string;
  volume: number;
  isMuted: boolean;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
  networkDelay: number;
  stats: any;
  isRecording: boolean;
  recordingDuration: number;
  activeEngine: PlayerEngine;
}

export interface AutoPlayerApi {
  getActiveEngine: () => PlayerEngine;
  getRawInstance: () => any;

  play: () => Promise<void>;
  pause: () => Promise<void>;
  toggle: () => Promise<void>;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setUrl: (u: string) => void;
  setScaleMode: (mode: 0 | 1 | 2) => void;
  screenshot: (opts?: any) => Blob | string | undefined;
  startRecord: () => void;
  stopRecordAndSave: () => void;
  requestFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  destroy: () => Promise<void>;

  state: AutoPlayerState;
}

export interface AutoPlayerProps {
  url: string;
  preferEngine?: PlayerEngine;
  autoplay?: boolean;
  muted?: boolean;
  class?: string;
}

export interface AutoPlayerExpose {
  api: AutoPlayerApi;
}
