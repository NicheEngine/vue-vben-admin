import type { Ref } from 'vue';

import type { JessibucaPlayerApi } from './jessibuca-player-api';

export interface JessibucaConfig {
  // ...（配置项保持不变，此处省略，见原文件）

  autoPlay?: boolean;
  isMute?: boolean;
  volume?: number;
  debug?: boolean;
  isNotMute?: boolean;
  hiddenAutoPause?: boolean;
  keepScreenOn?: boolean;

  decoder?: string;
  autoWasm?: boolean;
  useMSE?: boolean;
  useWCS?: boolean;
  wcsUseVideoRender?: boolean;
  useOffscreen?: boolean;
  forceNoOffscreen?: boolean;
  wasmDecodeErrorReplay?: boolean;
  openWebglAlignment?: boolean;
  wasmDecodeAudioSyncVideo?: boolean;

  videoBuffer?: number;
  videoBufferDelay?: number;
  timeout?: number;
  loadingTimeout?: number;
  heartTimeout?: number;
  loadingTimeoutReplay?: boolean;
  heartTimeoutReplay?: boolean;
  loadingTimeoutReplayTimes?: number;
  heartTimeoutReplayTimes?: number;
  loadingDecoderWorkerTimeout?: number;

  isResize?: boolean;
  isFullResize?: boolean;
  scaleMode?: 0 | 1 | 2;
  rotate?: number;
  background?: string;

  supportDblclickFullscreen?: boolean;
  useWebFullScreen?: boolean;
  autoUseSystemFullScreen?: boolean;
  hotKey?: boolean;

  enableRecording?: boolean;
  recordType?: 'mp4' | 'webm';

  showBandwidth?: boolean;
  hasControl?: boolean;
  controlAutoHide?: boolean;
  operateBtns?: {
    fullscreen?: boolean;
    screenshot?: boolean;
    play?: boolean;
    audio?: boolean;
    record?: boolean;
  };
  loadingText?: string;
  watermark?: Record<string, any>;

  isFlv?: boolean;
  demuxType?: string;
  protocol?: number;

  hasAudio?: boolean;
  hasVideo?: boolean;
  headers?: Record<string, string>;
  url?: string;

  [key: string]: any;
}

export interface JessibucaInstance {
  play: (url?: string, options?: any) => Promise<void>;
  pause: () => Promise<void>;
  destroy: () => Promise<void>;
  close: () => Promise<void>;
  clearView: () => void;
  mute: () => void;
  cancelMute: () => void;
  setVolume: (volume: number) => void;
  setScaleMode: (mode: number) => void;
  setBufferTime: (time: number) => void;
  setRotate: (deg: number) => void;
  resize: () => void;
  /**
   * 截图。返回类型取决于 type 参数：
   * - download 或未传：返回 undefined（触发下载）
   * - base64：返回 string
   * - blob：返回 Blob
   */
  screenshot: (
    filename?: string,
    format?: 'jpeg' | 'png' | 'webp',
    quality?: number,
    type?: 'base64' | 'blob' | 'download',
  ) => Blob | string | undefined;
  startRecord: (fileName?: string, fileType?: string) => void;
  stopRecordAndSave: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  _opt?: JessibucaConfig;
  [key: string]: any;
}

export interface JessibucaState {
  url: string;
  isPlaying: boolean;
  isLoading: boolean;
  error: null | string;
  volume: number;
  isMuted: boolean;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
  networkDelay: number;
  isRecording: boolean;
}

export type JessibucaStoreState = JessibucaState & {
  config: JessibucaConfig;
};

export interface JessibucaPlayerProps {
  /**
   * 视频地址（可选）。
   * 组件只把它作为「初始值 / 变化源」同步到 api.store.state.url，
   * 播放一律以 api.store.state.url 为准，避免双份数据源。
   */
  url?: string;
  config?: JessibucaConfig;
  class?: string;
  controls?: boolean;
  /**
   * 外部注入的 api。
   * - 不传：组件内部自建，卸载时自动销毁
   * - 传入：组件复用外部实例，卸载时不销毁（由调用方负责）
   */
  api?: JessibucaPlayerApi;
}

export interface JessibucaCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: Error | string) => void;
  onLoad?: () => void;
  onVideoInfo?: (info: {
    width: number;
    height: number;
    encType: string;
  }) => void;
  onStats?: (stats: {
    buf: number;
    fps: number;
    abps: number;
    vbps: number;
    ts: number;
  }) => void;
  onTimeout?: (error: string) => void;
  onFullscreen?: (isFullscreen: boolean) => void;
  onMute?: (isMuted: boolean) => void;
  onRecordStart?: () => void;
  onRecordEnd?: (blob: Blob) => void;
  onRecording?: (duration: number) => void;
}

export interface JessibucaApiOptions
  extends JessibucaCallbacks, Partial<JessibucaStoreState> {}

export interface ExtendedJessibucaApi extends JessibucaPlayerApi {
  useSelector: <T = JessibucaStoreState>(
    selector?: (state: JessibucaStoreState) => T,
  ) => Readonly<Ref<T>>;
}
