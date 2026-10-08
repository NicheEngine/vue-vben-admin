import type { Ref } from 'vue';

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
  playerStyle?: string;
  poster?: string;
  progress?: boolean;
  reconnection?: boolean;
  recordFileName?: string;
  recordMaxFileSize?: number;
  remoteHost?: string;
  resolution?: string;
  resolutionDefault?: EasyResolution | string;
  restartTime?: number;
  showEnterprise?: boolean;
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
  restartPlayer?: () => void;
  snapshot?: () => void;
  switchAudio?: () => void;
  switchRecording?: () => void;
  switchVideo?: () => void;
  [key: string]: any;
}

/** Store 接口（简化，实际由 @vben-core/shared/store 提供） */
export interface EasyPlayerStore {
  state: EasyPlayerStoreState;
  setState: (
    updater: (prev: EasyPlayerStoreState) => EasyPlayerStoreState,
  ) => void;
}

/** 扩展 API，带 useSelector */
export interface ExtendedEasyPlayerApi {
  store: EasyPlayerStore;
  useSelector: <T = EasyPlayerStoreState>(
    selector?: (state: EasyPlayerStoreState) => T,
  ) => Readonly<Ref<T>>;
  bindInstance: (instance: EasyPlayerInstance | null) => void;
  destroy: () => void;
  destroyPlayer: () => void;
  exitFullscreen: () => void;
  fullscreen: () => void;
  initPlayer: () => void;
  pause: () => void;
  play: () => void;
  replay: () => void;
  seek: (time: number) => void;
  setError: (error: null | string) => void;
  setLoading: (loading: boolean) => void;
  setMuted: (muted: boolean) => void;
  setUrl: (url: string) => void;
  setVolume: (volume: number) => void;
  snapshot: () => void;
  switchAudio: () => void;
  switchRecording: () => void;
  switchVideo: () => void;
  toggle: () => void;
  updateCurrentTime: (time: number) => void;
  updatePlaying: (playing: boolean) => void;
  updateReady: (ready: boolean) => void;
}
