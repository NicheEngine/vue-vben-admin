import type { Ref } from 'vue';

/** Jessibuca 播放器配置 */
export interface JessibucaConfig {
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 是否静音 */
  isMute?: boolean;
  /** 音量 0-1 */
  volume?: number;
  /** 是否开启控制台日志 */
  debug?: boolean;
  /** 解码器路径（decoder.js） */
  decoder?: string;
  /** 超时时间（秒），无数据返回时触发 timeout 事件 */
  timeout?: number;
  /** 最大缓冲时长（秒） */
  videoBuffer?: number;
  /** 是否开启轮播 */
  isResize?: boolean;
  /** 画面缩放模式: 0-拉伸 1-等比留黑边 2-等比裁切 */
  scaleMode?: 0 | 1 | 2;
  /** 是否支持双击全屏 */
  supportDblclickFullscreen?: boolean;
  /** 是否使用系统全屏 API */
  useWebFullScreen?: boolean;
  /** 是否开启录像 */
  enableRecording?: boolean;
  /** 录像格式 */
  recordType?: 'mp4' | 'webm';
  /** HTTP 请求头 */
  headers?: Record<string, string>;
}

/** Jessibuca 实例接口（核心方法） */
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
  screenshot: (
    filename?: string,
    format?: string,
    quality?: number,
    type?: string,
  ) => string;
  startRecord: (fileName?: string, fileType?: string) => void;
  stopRecordAndSave: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  [key: string]: any;
}

/** 播放器内部状态 */
export interface JessibucaState {
  /** 当前播放地址 */
  url: string;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: null | string;
  /** 当前音量 */
  volume: number;
  /** 是否静音 */
  isMuted: boolean;
  /** 视频宽度 */
  videoWidth: number;
  /** 视频高度 */
  videoHeight: number;
  /** 已播放时长（秒） */
  currentTime: number;
  /** 网络延迟（毫秒） */
  networkDelay: number;
  /** 是否录制中 */
  isRecording: boolean;
}

export type JessibucaStoreState = JessibucaState & {
  config: JessibucaConfig;
};

/** 播放器 props */
export interface JessibucaPlayerProps {
  /** 视频地址 */
  url: string;
  /** 播放器配置 */
  config?: JessibucaConfig;
  /** 容器样式 */
  class?: string;
  /** 是否显示默认控制栏 */
  controls?: boolean;
}

/** 事件回调 */
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

/** 创建 API 的 options */
export interface JessibucaApiOptions
  extends JessibucaCallbacks, Partial<JessibucaStoreState> {}

/** 扩展 API，带 useSelector */
export interface ExtendedJessibucaApi {
  store: {
    state: JessibucaStoreState;
    setState: (
      updater: (prev: JessibucaStoreState) => JessibucaStoreState,
    ) => void;
  };
  useSelector: <T = JessibucaStoreState>(
    selector?: (state: JessibucaStoreState) => T,
  ) => Readonly<Ref<T>>;
  bindInstance: (instance: JessibucaInstance | null) => void;
  destroy: () => void;
  destroyPlayer: () => void;
  setUrl: (url: string) => void;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  toggle: () => Promise<void>;
  mute: () => void;
  cancelMute: () => void;
  setVolume: (volume: number) => void;
  setScaleMode: (mode: number) => void;
  setBufferTime: (time: number) => void;
  setRotate: (deg: number) => void;
  screenshot: (filename?: string, format?: string, quality?: number) => string;
  startRecord: (fileName?: string, fileType?: string) => void;
  stopRecordAndSave: () => void;
  resize: () => void;
  clearView: () => void;
}
