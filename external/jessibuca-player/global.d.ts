/// <reference types="vite/client" />

/**
 * Jessibuca 全局类型声明
 *
 * Jessibuca 通过全局 script 引入（jessibuca.js），
 * 实例挂载在 window.Jessibuca 上。
 *
 * 官方类型声明文件位置：node_modules/jessibuca/d.ts/jessibuca.d.ts
 * 如果包自带类型，优先使用官方声明；否则使用下方精简版。
 */

/** Jessibuca 配置项 */
interface JessibucaOptions {
  /** 容器元素或选择器 */
  container?: HTMLElement | string;
  /** 解码器路径，默认 /decoder.js */
  decoder?: string;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 是否静音 */
  isMute?: boolean;
  /** 音量 0-1 */
  volume?: number;
  /** 是否开启调试日志 */
  debug?: boolean;
  /** 超时时间（秒），无数据返回时触发 timeout */
  timeout?: number;
  /** 最大缓冲时长（秒） */
  videoBuffer?: number;
  /** 是否自动调整尺寸 */
  isResize?: boolean;
  /** 画面缩放模式：0-拉伸 1-等比留黑边 2-等比裁切 */
  scaleMode?: 0 | 1 | 2;
  /** 是否支持双击全屏 */
  supportDblclickFullscreen?: boolean;
  /** 是否使用系统全屏 API */
  useWebFullScreen?: boolean;
  /** 是否开启录制 */
  enableRecording?: boolean;
  /** 录制格式 */
  recordType?: 'mp4' | 'webm';
  /** HTTP 请求头 */
  headers?: Record<string, string>;
  /** 是否显示底部控制栏 */
  showBandwidth?: boolean;
  /** 是否显示性能面板 */
  showPerformance?: boolean;
  /** 是否开启水印 */
  watermark?: Record<string, any>;
  /** 是否开启音频 */
  hasAudio?: boolean;
  /** 操作栏配置 */
  operateBtns?: {
    fullscreen?: boolean;
    screenshot?: boolean;
    play?: boolean;
    audio?: boolean;
    record?: boolean;
  };
}

/** Jessibuca 错误码常量 */
interface JessibucaErrorConstants {
  playError: string;
  fetchError: string;
  websocketError: string;
  webcodecsH265NotSupport: string;
  mediaSourceH265NotSupport: string;
  wasmDecodeError: string;
  mseDecodeError: string;
  wcsDecodeError: string;
  loadingTimeout: string;
  timeout: string;
  streamEnd: string;
  webglAlignmentError: string;
  webglContextLostError: string;
  videoElementPlayingFailed: string;
}

/** Jessibuca 超时类型常量 */
interface JessibucaTimeoutConstants {
  loadingTimeout: string;
  delayTimeout: string;
  networkDelayTimeout: string;
}

/** Jessibuca 实例接口 */
interface JessibucaInstance {
  // ========== 播放控制 ==========
  /** 重新播放当前 URL */
  play(
    url?: string,
    options?: { headers?: Record<string, string> },
  ): Promise<void>;
  /** 暂停播放 */
  pause(): Promise<void>;
  /** 销毁播放器 */
  destroy(): Promise<void>;
  /** 关闭播放（等同 destroy） */
  close(): Promise<void>;
  /** 清除画面 */
  clearView(): void;
  // ========== 音频控制 ==========
  /** 静音 */
  mute(): void;
  /** 取消静音 */
  cancelMute(): void;
  /** 设置音量 */
  setVolume(volume: number): void;

  // ========== 画面控制 ==========
  /** 设置缩放模式 */
  setScaleMode(mode: 0 | 1 | 2): void;
  /** 设置缓冲时长 */
  setBufferTime(time: number): void;
  /** 设置旋转角度 */
  setRotate(deg: number): void;
  /** 调整尺寸 */
  resize(): void;
  /** 设置超时时间 */
  setTimeout(time: number): void;

  // ========== 截图与录制 ==========
  /** 截图 */
  screenshot(
    filename?: string,
    format?: string,
    quality?: number,
    type?: string,
  ): string;
  /** 开始录制 */
  startRecord(fileName?: string, fileType?: string): void;
  /** 停止录制并保存 */
  stopRecordAndSave(): void;

  // ========== 事件系统 ==========
  /** 监听事件 */
  on(event: string, handler: (...args: any[]) => void): void;
  /** 取消监听 */
  off(event: string, handler?: (...args: any[]) => void): void;

  // ========== 状态属性 ==========
  /** 是否已加载完成 */
  loaded: boolean;
  /** 是否正在播放 */
  playing: boolean;
  /** 播放器配置 */
  _opt: JessibucaOptions;

  // ========== 常量 ==========
  /** 错误码常量 */
  ERROR: JessibucaErrorConstants;
  /** 超时类型常量 */
  TIMEOUT: JessibucaTimeoutConstants;
}

/** Jessibuca 构造器接口 */
interface JessibucaConstructor {
  new (options: JessibucaOptions): JessibucaInstance;
  (options: JessibucaOptions): JessibucaInstance;
}

declare global {
  interface Window {
    /** Jessibuca 全局构造器 */
    Jessibuca: JessibucaConstructor;
  }
}
