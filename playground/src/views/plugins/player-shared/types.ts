import type { Ref } from 'vue';

export interface PlayerCapabilities {
  screenshot: boolean;
  record: boolean;
  scaleMode: boolean;
  stats: boolean;
  seek: boolean;
  fullscreen: boolean;
}

export interface PlayerStats {
  buf?: number;
  fps?: number;
  abps?: number;
  vbps?: number;
  ts?: number;
}

/**
 * 播放器统一接口。
 * 所有 Ref 都是只读语义，adapter 内部用 computed 从各自 store 映射。
 */
export interface IPlayerApi {
  // ===== 状态 =====
  isPlaying: Readonly<Ref<boolean>>;
  isLoading: Readonly<Ref<boolean>>;
  isReady: Readonly<Ref<boolean>>;
  error: Readonly<Ref<null | string>>;
  volume: Readonly<Ref<number>>;
  isMuted: Readonly<Ref<boolean>>;
  videoWidth: Readonly<Ref<number>>;
  videoHeight: Readonly<Ref<number>>;
  currentTime: Readonly<Ref<number>>;
  networkDelay: Readonly<Ref<number>>;
  isRecording: Readonly<Ref<boolean>>;
  recordingDuration: Readonly<Ref<number>>;
  scaleMode: Readonly<Ref<0 | 1 | 2>>;
  stats: Readonly<Ref<PlayerStats>>;

  // ===== 能力声明 =====
  capabilities: PlayerCapabilities;
  setLoading?: (loading: boolean) => void;
  updatePlaying?: (playing: boolean) => void;
  updateLoading?: (loading: boolean) => void;
  // ===== 基础控制 =====
  play: () => Promise<void>;
  pause: () => Promise<void>;
  toggle: () => Promise<void>;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setUrl: (url: string) => void;
  destroy: () => Promise<void>;

  // ===== 可选控制（capabilities 决定是否可用） =====
  seek?: (t: number) => void;
  resize?: () => void;
  screenshot?: (opts?: {
    filename?: string;
    format?: 'jpeg' | 'png' | 'webp';
    type?: 'base64' | 'blob' | 'download';
  }) => Blob | string | undefined;
  setScaleMode?: (mode: 0 | 1 | 2) => void;
  startRecord?: (name?: string, type?: string) => void;
  stopRecordAndSave?: () => void;
}
