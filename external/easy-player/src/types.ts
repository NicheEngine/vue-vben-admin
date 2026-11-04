import type { Ref } from 'vue';

import type { EasyPlayerApi } from './easy-player-api';

/** 解码类型，仅 flv 有效 */
export type EasyDecodeType = 'auto' | 'soft';

/** 清晰度，仅 hls 有效 */
export type EasyResolution = 'fhd' | 'hd' | 'sd' | 'yh';

/** 播放器 props */
export interface EasyPlayerProps {
  alt?: string;
  aspect?: string;
  autoplay?: boolean;
  currentTime?: number;
  debug?: boolean;
  decodeType?: EasyDecodeType;
  easyStretch?: boolean;
  hasAudio?: boolean;
  hiddenRightMenu?: boolean;
  iceServers?: RTCIceServer[];
  isH265?: boolean;
  isTransCoding?: boolean;
  live?: boolean;
  loop?: boolean;
  muted?: boolean;
  playerApi?: EasyPlayerApi;
  playerStyle?: string;
  poster?: string;
  progress?: boolean;
  reconnection?: boolean;
  recordFileName?: string;
  recordMaxFileSize?: number;
  remoteHost?: string;
  resolution?: string;
  resolutionDefault?: EasyResolution;
  restartTime?: number;
  scaleMode?: 0 | 1 | 2;
  /** 离屏继续播放（拦截滚动触发的自动暂停），默认 false */
  keepPlayingOffscreen?: boolean;
  showEnterprise?: boolean;
  showCustomButton?: boolean;
  url?: string;
  videoTitle?: string;
  videoUrl: string;
  watermark?: string;
}

/** 播放器内部状态 */
export interface EasyPlayerState {
  currentTime: number;
  error: null | string;
  isLoading: boolean;
  isPlaying: boolean;
  isReady: boolean;
  volume: number;
  videoWidth: number;
  videoHeight: number;
  keepPlayingOffscreen: boolean;
}

export type EasyPlayerStoreState = EasyPlayerProps & EasyPlayerState;

/** 事件回调 */
export interface EasyPlayerCallbacks {
  onEnded?: () => void;
  onError?: (error: Error | string) => void;
  onPause?: () => void;
  onPlay?: () => void;
  onRecording?: () => void;
  onSnapshot?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}

/** 创建 API 的 options */
export interface EasyPlayerApiOptions
  extends EasyPlayerCallbacks, Partial<EasyPlayerStoreState> {}

/** 底层 EasyPlayer 实例 */
export interface EasyPlayerInstance {
  changeStretch?: (stretch: boolean) => void;
  destroyPlayer?: () => void;
  exitFullscreen?: () => void;
  fullscreen?: () => void;
  initPlayer?: () => void;
  pause?: () => void;
  play?: () => void;
  restartPlayer?: () => void;
  snapshot?: () => unknown;
  switchAudio?: () => void;
  switchRecording?: () => void;
  switchVideo?: () => void;
  [key: string]: any;
}

/** Store 接口 */
export interface EasyPlayerStore {
  state: EasyPlayerStoreState;
  setState: (
    updater: (prev: EasyPlayerStoreState) => EasyPlayerStoreState,
  ) => void;
}

export interface ExtendedEasyPlayerApi extends EasyPlayerApi {
  useSelector: <T = EasyPlayerStoreState>(
    selector?: (state: EasyPlayerStoreState) => T,
  ) => Readonly<Ref<T>>;
}
