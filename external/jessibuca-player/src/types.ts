import type { Ref } from 'vue';

import type { JessibucaPlayerApi } from './jessibuca-player-api';

/**
 * Jessibuca 播放器配置。
 *
 * 参考 Jessibuca 3.x 官方文档：
 * https://jessibuca.com/api.html
 */
export interface JessibucaConfig {
  // ========== 基础 ==========
  /** 是否自动播放（首帧就绪后） */
  autoPlay?: boolean;
  /** 是否静音 */
  isMute?: boolean;
  /** 音量 0-1 */
  volume?: number;
  /** 是否输出控制台调试日志 */
  debug?: boolean;
  /** 是否强制打开音频 */
  isNotMute?: boolean;
  /** 是否隐藏时自动暂停 */
  hiddenAutoPause?: boolean;
  /** 是否保持屏幕常亮 */
  keepScreenOn?: boolean;

  // ========== 解码器 ==========
  /**
   * 解码器路径。
   * - 可为相对路径（如 `/jessibuca/decoder.js`）
   * - 也可为绝对 URL
   * 组件内部会规整为绝对 URL，避免被解析成相对当前页面路径。
   */
  decoder?: string;
  /** 是否自动加载 wasm 解码器 */
  autoWasm?: boolean;
  /** 是否使用 MSE 解码（不需要 wasm 解码器） */
  useMSE?: boolean;
  /** 是否使用 WebCodecs 解码 */
  useWCS?: boolean;
  /** 是否使用 WebCodecs 渲染视频 */
  wcsUseVideoRender?: boolean;
  /** 是否使用 OffscreenCanvas */
  useOffscreen?: boolean;
  /** 是否强制不使用 OffscreenCanvas */
  forceNoOffscreen?: boolean;
  /** wasm 解码错误时是否自动重播 */
  wasmDecodeErrorReplay?: boolean;
  /** WebGL 对齐（部分 H.265 需要） */
  openWebglAlignment?: boolean;
  /** wasm 解码音频与视频同步 */
  wasmDecodeAudioSyncVideo?: boolean;

  // ========== 缓冲/超时 ==========
  /** 最大缓冲时长（毫秒），默认 1000 */
  videoBuffer?: number;
  /** 缓冲延迟（毫秒），默认 1000 */
  videoBufferDelay?: number;
  /** 超时时间（秒），无数据返回时触发 timeout */
  timeout?: number;
  /** loading 超时时间（秒），默认与 timeout 相同 */
  loadingTimeout?: number;
  /** 心跳超时时间（秒），默认与 timeout 相同 */
  heartTimeout?: number;
  /** loading 超时是否自动重播，默认 true */
  loadingTimeoutReplay?: boolean;
  /** 心跳超时是否自动重播，默认 true */
  heartTimeoutReplay?: boolean;
  /** loading 超时自动重播次数，默认 3 */
  loadingTimeoutReplayTimes?: number;
  /** 心跳超时自动重播次数，默认 3 */
  heartTimeoutReplayTimes?: number;
  /** 等待 decoderWorker 初始化的超时时间（秒） */
  loadingDecoderWorkerTimeout?: number;

  // ========== 画面 ==========
  /** 是否自动调整尺寸，默认 true */
  isResize?: boolean;
  /** 是否全屏等比缩放 */
  isFullResize?: boolean;
  /** 缩放模式：0-拉伸 1-等比留黑边 2-等比裁切 */
  scaleMode?: 0 | 1 | 2;
  /** 旋转角度 */
  rotate?: number;
  /** 背景色 */
  background?: string;

  // ========== 交互 ==========
  /** 是否支持双击全屏 */
  supportDblclickFullscreen?: boolean;
  /** 是否使用系统全屏 API */
  useWebFullScreen?: boolean;
  /** 是否自动使用系统全屏 */
  autoUseSystemFullScreen?: boolean;
  /** 是否开启键盘快捷键 */
  hotKey?: boolean;

  // ========== 录制 ==========
  /** 是否开启录像 */
  enableRecording?: boolean;
  /** 录像格式 */
  recordType?: 'mp4' | 'webm';

  // ========== 控制栏 ==========
  /** 是否显示带宽 */
  showBandwidth?: boolean;
  /** 是否有控制栏 */
  hasControl?: boolean;
  /** 控制栏是否自动隐藏 */
  controlAutoHide?: boolean;
  /** 操作按钮配置 */
  operateBtns?: {
    fullscreen?: boolean;
    screenshot?: boolean;
    play?: boolean;
    audio?: boolean;
    record?: boolean;
  };
  /** loading 文案 */
  loadingText?: string;
  /** 水印配置 */
  watermark?: Record<string, any>;

  // ========== 协议 ==========
  /** 是否 flv 流（用于强制指定 demux 类型） */
  isFlv?: boolean;
  /** demux 类型：'flv' | 'mpegts' | ... */
  demuxType?: string;
  /** 协议类型 1=HTTP-FLV 2=WebSocket-FLV */
  protocol?: number;

  // ========== 其他 ==========
  /** 音频流（true/false） */
  hasAudio?: boolean;
  /** 视频流（true/false） */
  hasVideo?: boolean;
  /** HTTP 请求头 */
  headers?: Record<string, string>;
  /** 视频 URL（一般由 play() 传入，构造时也可指定） */
  url?: string;

  /** 其它透传给 Jessibuca 的配置 */
  [key: string]: any;
}

/** Jessibuca 实例接口 */
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
   * 截图。
   * 注意：Jessibuca 3.x 内部对 undefined 参数较敏感，
   * 最好只传真正有值的参数。
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
  /** 内部配置（只读，用于同步 url） */
  _opt?: JessibucaConfig;
  [key: string]: any;
}

/** 播放器内部状态 */
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

/** 播放器 props */
export interface JessibucaPlayerProps {
  /** 视频地址 */
  url: string;
  /** 播放器配置 */
  config?: JessibucaConfig;
  /** 容器 class */
  class?: string;
  /** 是否显示默认控制栏（保留字段） */
  controls?: boolean;
  /**
   * 外部注入的 api。
   * 由 useJessibucaPlayer 创建并传入，组件内部不再自己 new，
   * 保证外部和组件共用同一个 api 实例。
   */
  api: JessibucaPlayerApi;
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

/** 扩展 API（外部通过 useJessibucaPlayer 拿到的就是它） */
export interface ExtendedJessibucaApi extends JessibucaPlayerApi {
  useSelector: <T = JessibucaStoreState>(
    selector?: (state: JessibucaStoreState) => T,
  ) => Readonly<Ref<T>>;
}
