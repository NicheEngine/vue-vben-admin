import type { Store } from '@vben-core/shared/store';

import type {
  JessibucaApiOptions,
  JessibucaCallbacks,
  JessibucaInstance,
  JessibucaStoreState,
} from './types';

import { createStore } from '@vben-core/shared/store';
import { bindMethods } from '@vben-core/shared/utils';

function createDefaultState(): JessibucaStoreState {
  return {
    url: '',
    isPlaying: false,
    isLoading: false,
    error: null,
    volume: 1,
    isMuted: false,
    videoWidth: 0,
    videoHeight: 0,
    currentTime: 0,
    networkDelay: 0,
    isRecording: false,
    config: {
      autoPlay: true,
      isMute: false,
      volume: 1,
      debug: false,
      decoder: '/decoder.js',
      timeout: 10,
      videoBuffer: 0.5,
      isResize: true,
      scaleMode: 1,
      supportDblclickFullscreen: true,
      useWebFullScreen: false,
      enableRecording: false,
      recordType: 'webm',
    },
  };
}

export class JessibucaPlayerApi {
  public store: Store<JessibucaStoreState>;

  private boundHandlers: Map<string, (...args: any[]) => void> = new Map();
  private callbacks: JessibucaCallbacks;
  private instance: JessibucaInstance | null = null;

  constructor(options: JessibucaApiOptions = {}) {
    const {
      onPlay,
      onPause,
      onError,
      onLoad,
      onVideoInfo,
      onStats,
      onTimeout,
      onFullscreen,
      onMute,
      onRecordStart,
      onRecordEnd,
      onRecording,
      ...storeState
    } = options;

    this.callbacks = {
      onPlay,
      onPause,
      onError,
      onLoad,
      onVideoInfo,
      onStats,
      onTimeout,
      onFullscreen,
      onMute,
      onRecordStart,
      onRecordEnd,
      onRecording,
    };

    this.store = createStore<JessibucaStoreState>({
      ...createDefaultState(),
      ...storeState,
    });

    bindMethods(this);
  }

  /** 绑定底层 Jessibuca 实例 */
  bindInstance(instance: JessibucaInstance | null) {
    if (this.instance) {
      this.unbindEvents();
    }
    this.instance = instance;
    if (instance) {
      this.bindEvents();
    }
  }

  /** 取消静音 */
  cancelMute() {
    this.instance?.cancelMute();
    this.store.setState((prev) => ({ ...prev, isMuted: false }));
  }

  /** 清除画面 */
  clearView() {
    this.instance?.clearView();
  }

  /** 销毁 */
  async destroy() {
    await this.destroyPlayer();
  }

  /** 销毁播放器 */
  async destroyPlayer() {
    this.unbindEvents();
    await this.instance?.destroy();
    this.instance = null;
  }

  /** 静音 */
  mute() {
    this.instance?.mute();
    this.store.setState((prev) => ({ ...prev, isMuted: true }));
  }

  /** 暂停 */
  async pause() {
    await this.instance?.pause();
  }

  /** 播放 */
  async play() {
    const { url } = this.store.state;
    if (!url) {
      this.setError('播放地址为空');
      return;
    }
    this.updateLoading(true);
    try {
      await this.instance?.play(url);
    } catch (error: any) {
      this.setError(error?.message || '播放失败');
    }
  }

  /** 调整尺寸 */
  resize() {
    this.instance?.resize();
  }

  /** 截图 */
  screenshot(filename?: string, format?: string, quality?: number) {
    return this.instance?.screenshot(filename, format, quality);
  }

  /** 设置缓冲时长 */
  setBufferTime(time: number) {
    this.instance?.setBufferTime(time);
  }

  setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error, isLoading: false }));
    if (error) {
      this.callbacks.onError?.(new Error(error));
    }
  }

  /** 设置旋转角度 */
  setRotate(deg: number) {
    this.instance?.setRotate(deg);
  }

  /** 设置缩放模式 */
  setScaleMode(mode: 0 | 1 | 2) {
    this.instance?.setScaleMode(mode);
    this.store.setState((prev) => ({
      ...prev,
      config: { ...prev.config, scaleMode: mode },
    }));
  }

  /** 设置播放地址 */
  setUrl(url: string) {
    this.store.setState((prev) => ({ ...prev, url, error: null }));
    if (this.instance && this.store.state.isPlaying) {
      this.play();
    }
  }

  /** 设置音量 */
  setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    this.instance?.setVolume(vol);
    this.store.setState((prev) => ({ ...prev, volume: vol }));
  }

  /** 开始录制 */
  startRecord(fileName?: string, fileType?: string) {
    this.instance?.startRecord(fileName, fileType);
  }

  /** 停止录制并保存 */
  stopRecordAndSave() {
    this.instance?.stopRecordAndSave();
  }

  /** 切换播放/暂停 */
  async toggle() {
    if (this.store.state.isPlaying) {
      await this.pause();
      return;
    }
    await this.play();
  }

  /** 绑定所有事件回调 */
  private bindEvents() {
    if (!this.instance) return;

    const handlers: Record<string, (...args: any[]) => void> = {
      play: () => {
        this.updatePlaying(true);
        this.callbacks.onPlay?.();
      },
      pause: () => {
        this.updatePlaying(false);
        this.callbacks.onPause?.();
      },
      loading: () => {
        this.updateLoading(true);
      },
      load: () => {
        this.callbacks.onLoad?.();
      },
      videoInfo: (info: { width: number; height: number; encType: string }) => {
        this.store.setState((prev) => ({
          ...prev,
          videoWidth: info.width,
          videoHeight: info.height,
        }));
        this.callbacks.onVideoInfo?.(info);
      },
      stats: (stats: {
        buf: number;
        fps: number;
        abps: number;
        vbps: number;
        ts: number;
      }) => {
        this.store.setState((prev) => ({
          ...prev,
          networkDelay: stats.buf,
          currentTime: stats.ts,
        }));
        this.callbacks.onStats?.(stats);
      },
      error: (error: Error | string) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setError(message);
        this.callbacks.onError?.(error);
      },
      timeout: (error: string) => {
        this.setError(`播放超时: ${error}`);
        this.callbacks.onTimeout?.(error);
      },
      fullscreen: (isFullscreen: boolean) => {
        this.callbacks.onFullscreen?.(isFullscreen);
      },
      mute: (isMuted: boolean) => {
        this.store.setState((prev) => ({ ...prev, isMuted }));
        this.callbacks.onMute?.(isMuted);
      },
      recordStart: () => {
        this.store.setState((prev) => ({ ...prev, isRecording: true }));
        this.callbacks.onRecordStart?.();
      },
      recordEnd: (blob: Blob) => {
        this.store.setState((prev) => ({ ...prev, isRecording: false }));
        this.callbacks.onRecordEnd?.(blob);
      },
      recording: (duration: number) => {
        this.callbacks.onRecording?.(duration);
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      this.boundHandlers.set(event, handler);
      this.instance.on(event, handler);
    }
  }

  // ========== 状态更新方法 ==========

  /** 解绑所有事件回调 */
  private unbindEvents() {
    if (!this.instance) return;
    for (const [event, handler] of this.boundHandlers) {
      this.instance.off(event, handler);
    }
    this.boundHandlers.clear();
  }

  private updateLoading(loading: boolean) {
    if (this.store.state.isLoading !== loading) {
      this.store.setState((prev) => ({ ...prev, isLoading: loading }));
    }
  }

  private updatePlaying(playing: boolean) {
    if (this.store.state.isPlaying !== playing) {
      this.store.setState((prev) => ({ ...prev, isPlaying: playing }));
    }
  }
}
