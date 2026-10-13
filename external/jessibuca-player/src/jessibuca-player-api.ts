import type { Store } from '@vben-core/shared/store';

import type {
  JessibucaApiOptions,
  JessibucaCallbacks,
  JessibucaConfig,
  JessibucaInstance,
  JessibucaStoreState,
} from './types';

import { createStore } from '@vben-core/shared/store';
import { bindMethods } from '@vben-core/shared/utils';

/**
 * 把 decoder 规整为绝对 URL。
 * Jessibuca 内部对相对路径的解析基于"当前页面 URL"，
 * SPA 下会拼成 `/plugins/decoder.js` 这种错误路径，
 * 统一转成绝对 URL 可彻底避免。
 */
function normalizeDecoder(decoder?: string): string | undefined {
  if (!decoder) return decoder;
  if (/^https?:\/\//i.test(decoder) || decoder.startsWith('//')) {
    return decoder;
  }
  if (typeof window === 'undefined') return decoder;
  const path = decoder.startsWith('/') ? decoder : `/${decoder}`;
  return `${window.location.origin}${path}`;
}

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
      loadingTimeout: 10,
      heartTimeout: 10,
      videoBuffer: 0.5,
      videoBufferDelay: 1,
      isResize: true,
      isFullResize: false,
      scaleMode: 1,
      supportDblclickFullscreen: true,
      useWebFullScreen: false,
      autoUseSystemFullScreen: true,
      enableRecording: false,
      recordType: 'webm',
      // 关闭 Jessibuca 内部自动重播，避免和外部 setUrl 打架
      loadingTimeoutReplay: false,
      heartTimeoutReplay: false,
      loadingTimeoutReplayTimes: 0,
      heartTimeoutReplayTimes: 0,
    },
  };
}

export class JessibucaPlayerApi {
  public store: Store<JessibucaStoreState>;

  private boundHandlers = new Map<string, (...args: any[]) => void>();
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

    const defaults = createDefaultState();

    this.store = createStore<JessibucaStoreState>({
      ...defaults,
      ...storeState,
      config: {
        ...defaults.config,
        ...storeState.config,
      },
    });

    this.patchDecoderInStore();
    bindMethods(this);
  }

  // ========== 回调注入 ==========

  /**
   * 附加/覆盖回调。
   * 组件通过它把 emit 事件挂到 api 上。
   */
  public attachCallbacks(callbacks: JessibucaCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ========== 配置 ==========

  public bindInstance(instance: JessibucaInstance | null) {
    if (this.instance) this.unbindEvents();
    this.instance = instance;
    if (instance) this.bindEvents();
  }

  cancelMute() {
    this.instance?.cancelMute();
    this.store.setState((prev) => ({ ...prev, isMuted: false }));
  }

  clearView() {
    this.instance?.clearView();
  }

  // ========== 实例生命周期 ==========

  public async destroy() {
    await this.destroyPlayer();
  }

  public async destroyPlayer() {
    this.unbindEvents();
    try {
      await this.instance?.destroy();
    } catch (error) {
      console.warn('[JessibucaPlayerApi] destroy error:', error);
    }
    this.instance = null;
  }

  public getInstance(): JessibucaInstance | null {
    return this.instance;
  }

  /** 供组件构造 Jessibuca 时使用（decoder 保证绝对 URL） */
  public getResolvedConfig(): JessibucaConfig {
    const cfg = { ...this.store.state.config };
    if (cfg.decoder) {
      cfg.decoder = normalizeDecoder(cfg.decoder);
    }
    return cfg;
  }

  // ========== 播放控制 ==========

  mute() {
    this.instance?.mute();
    this.store.setState((prev) => ({ ...prev, isMuted: true }));
  }

  async pause() {
    await this.instance?.pause();
  }

  async play() {
    const { url } = this.store.state;
    if (!url) {
      this.setError('播放地址为空');
      return;
    }
    if (!this.instance) {
      this.setError('播放器尚未初始化');
      console.warn('[JessibucaPlayerApi] instance 为空，play 未执行');
      return;
    }

    this.syncUrlToInstance(url);

    this.updateLoading(true);
    this.store.setState((prev) => ({ ...prev, error: null }));

    try {
      await this.instance.play(url);
    } catch (error: any) {
      this.setError(error?.message || '播放失败');
    }
  }

  resize() {
    this.instance?.resize();
  }

  /**
   * 截图。
   * 官方推荐签名：screenshot(filename, format, quality, type)
   * - filename: 文件名（不含扩展名），默认时间戳
   * - format: 'png' | 'jpeg' | 'webp'，默认 png
   * - quality: 0.0-1.0，仅 jpeg/webp 有效，默认 0.92
   * - type: 'download' | 'base64' | 'blob'，默认 download
   *
   * 返回类型取决于 type 参数：
   * - 'download' 或未传: 触发下载，返回 undefined
   * - 'base64': 返回 base64 字符串
   * - 'blob': 返回 Blob 对象
   */
  screenshot(
    filename?: string,
    format?: 'jpeg' | 'png' | 'webp',
    quality?: number,
    type?: 'base64' | 'blob' | 'download',
  ): Blob | string | undefined {
    if (!this.instance) {
      console.warn('[JessibucaPlayerApi] instance 为空，screenshot 未执行');
      return undefined;
    }

    const inst = this.instance as any;
    if (typeof inst.screenshot !== 'function') {
      console.warn('[JessibucaPlayerApi] 当前 Jessibuca 实例不支持 screenshot');
      return undefined;
    }

    // 官方推荐直传四个参数，让 Jessibuca 内部自行处理默认值
    return inst.screenshot(filename, format, quality, type);
  }

  setBufferTime(time: number) {
    this.instance?.setBufferTime(time);
  }

  /** 用最新的 config 合并到 store */
  public setConfig(config: Partial<JessibucaConfig>) {
    const merged = { ...this.store.state.config, ...config };
    if (merged.decoder) {
      merged.decoder = normalizeDecoder(merged.decoder);
    }
    this.store.setState((prev) => ({ ...prev, config: merged }));
  }

  setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error, isLoading: false }));
    if (error) this.callbacks.onError?.(new Error(error));
  }

  // ========== 画面控制 ==========

  setRotate(deg: number) {
    this.instance?.setRotate(deg);
  }

  setScaleMode(mode: 0 | 1 | 2) {
    const inst = this.instance as any;
    if (inst) {
      inst.setScaleMode(mode);
      if (inst._opt) {
        inst._opt = { ...inst._opt, scaleMode: mode };
      }
      inst.resize();
    }
    this.store.setState((prev) => ({
      ...prev,
      config: { ...prev.config, scaleMode: mode },
    }));
  }

  setUrl(url: string) {
    this.store.setState((prev) => ({ ...prev, url, error: null }));
    this.syncUrlToInstance(url);

    if (this.instance && this.store.state.isPlaying) {
      void this.play();
    }
  }

  setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    this.instance?.setVolume(vol);
    this.store.setState((prev) => ({ ...prev, volume: vol }));
  }

  startRecord(fileName?: string, fileType?: string) {
    this.instance?.startRecord(fileName, fileType);
  }

  // ========== 截图与录制 ==========

  stopRecordAndSave() {
    this.instance?.stopRecordAndSave();
  }

  async toggle() {
    if (this.store.state.isPlaying) {
      await this.pause();
      return;
    }
    await this.play();
  }

  private bindEvents() {
    if (!this.instance) return;

    const handlers: Record<string, (...args: any[]) => void> = {
      play: () => {
        this.updatePlaying(true);
        this.updateLoading(false);
        this.callbacks.onPlay?.();
      },
      pause: () => {
        this.updatePlaying(false);
        this.callbacks.onPause?.();
      },
      loading: () => this.updateLoading(true),
      load: () => this.callbacks.onLoad?.(),
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
      fullscreen: (isFullscreen: boolean) =>
        this.callbacks.onFullscreen?.(isFullscreen),
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
      recording: (duration: number) => this.callbacks.onRecording?.(duration),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      this.boundHandlers.set(event, handler);
      this.instance.on(event, handler);
    }
  }

  // ========== 内部工具 ==========

  private patchDecoderInStore() {
    const decoder = this.store.state.config.decoder;
    const normalized = normalizeDecoder(decoder);
    if (normalized && normalized !== decoder) {
      this.store.setState((prev) => ({
        ...prev,
        config: { ...prev.config, decoder: normalized },
      }));
    }
  }

  /** 把 url 同步到 Jessibuca 实例的 _opt.url */
  private syncUrlToInstance(url: string) {
    const inst = this.instance as any;
    if (inst && inst._opt) {
      inst._opt = { ...inst._opt, url };
    }
  }

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
