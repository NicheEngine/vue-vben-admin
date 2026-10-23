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

function normalizeDecoder(decoder?: string): string | undefined {
  if (!decoder) return decoder;
  if (/^https?:\/\//i.test(decoder) || decoder.startsWith('//')) {
    return decoder;
  }
  if (typeof window === 'undefined') return decoder;
  const path = decoder.startsWith('/') ? decoder : `/${decoder}`;
  return `${window.location.origin}${path}`;
}

/**
 * 结构性配置：一旦实例创建就不能改，
 * 变了必须销毁重建，否则不生效。
 */
const STRUCTURAL_CONFIG_KEYS = new Set<keyof JessibucaConfig>([
  'autoWasm',
  'decoder',
  'enableRecording',
  'forceNoOffscreen',
  'openWebglAlignment',
  'recordType',
  'useMSE',
  'useOffscreen',
  'useWCS',
  'wcsUseVideoRender',
]);

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
    recordingDuration: 0,
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
  /** 组件层回调（setComponentCallbacks 更新，用户不可覆盖） */
  private componentCallbacks: JessibucaCallbacks = {};
  private instance: JessibucaInstance | null = null;
  /**
   * 结构性配置变化时置 true。
   * 组件 watch 到后销毁重建实例，重建完由组件调用 clearRebuildFlag()。
   */
  private rebuildFlag = false;

  /** 用户层回调（setCallbacks 更新） */
  private userCallbacks: JessibucaCallbacks = {};

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
      initialUrl,
      initialConfig,
      initialState,
      ...rest
    } = options;

    this.userCallbacks = {
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
      ...initialState,
      // rest 里的 url/config 等旧字段作兜底（不推荐新代码使用）
      ...rest,
      url: initialUrl ?? rest.url ?? defaults.url,
      config: {
        ...defaults.config,
        ...initialConfig,
        ...rest.config,
      },
    });

    this.patchDecoderInStore();
    bindMethods(this);
  }

  // ========== 回调注入 ==========

  public bindInstance(instance: JessibucaInstance | null) {
    if (this.instance) this.unbindEvents();
    this.instance = instance;
    if (instance) this.bindEvents();
  }

  cancelMute() {
    this.instance?.cancelMute();
    this.store.setState((prev) => ({
      ...prev,
      isMuted: false,
      config: { ...prev.config, isMute: false },
    }));
  }

  public clearRebuildFlag() {
    this.rebuildFlag = false;
  }

  async clearView() {
    const inst = this.instance as any;
    if (!inst) return;
    try {
      // 先暂停，防止新帧覆盖清屏
      await inst.pause?.();
      inst.clearView?.();
    } catch (error) {
      console.warn('[JessibucaPlayerApi] clearView error:', error);
    }
    this.updatePlaying(false);
  }

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

  // ========== 配置 ==========

  public getCallbacks(): Readonly<JessibucaCallbacks> {
    return this.userCallbacks;
  }

  public getInstance(): JessibucaInstance | null {
    return this.instance;
  }

  public getResolvedConfig(): JessibucaConfig {
    const cfg = { ...this.store.state.config };
    if (cfg.decoder) {
      cfg.decoder = normalizeDecoder(cfg.decoder);
    }
    return cfg;
  }

  // ========== 实例生命周期 ==========

  mute() {
    this.instance?.mute();
    this.store.setState((prev) => ({
      ...prev,
      isMuted: true,
      config: { ...prev.config, isMute: true },
    }));
  }

  public needsRebuild(): boolean {
    return this.rebuildFlag;
  }

  async pause() {
    await this.instance?.pause();
  }

  // ========== 重建标记 ==========

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

  // ========== 播放控制 ==========

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
    // 防御：filename 不能为 undefined（会触发 r.split is not a function）
    const safeName = filename ?? `jessibuca-${Date.now()}`;
    return inst.screenshot(
      safeName,
      format ?? 'png',
      quality ?? 1,
      type ?? 'base64',
    );
  }

  setBufferTime(time: number) {
    this.instance?.setBufferTime(time);
  }

  public setCallbacks(callbacks: JessibucaCallbacks) {
    this.userCallbacks = { ...this.userCallbacks, ...callbacks };
  }

  /**
   * 组件专用回调通道，用户无法覆盖。
   * 仅在 jessibuca-player.vue 内部调用。
   */
  public setComponentCallbacks(callbacks: JessibucaCallbacks) {
    this.componentCallbacks = callbacks;
  }

  /**
   * 合并 config 到 store。
   * - 热更新项：立即调用对应 setter
   * - 结构性项：置 rebuildFlag，组件 watch 到后销毁重建
   *
   * 注意：传入的 config 先 normalize（decoder 转绝对 URL），
   * 再和 prevCfg 比较，避免 decoder 的假阳性导致误重建。
   */
  public setConfig(config: Partial<JessibucaConfig>) {
    const prevCfg = this.store.state.config;

    // 先 normalize 传入的 config
    const incoming: Partial<JessibucaConfig> = { ...config };
    if (incoming.decoder) {
      incoming.decoder = normalizeDecoder(incoming.decoder);
    }

    const merged = { ...prevCfg, ...incoming };
    this.store.setState((prev) => ({ ...prev, config: merged }));

    // ---- 热更新（按优先级从底层到上层）----
    if (
      incoming.scaleMode !== undefined &&
      incoming.scaleMode !== prevCfg.scaleMode
    ) {
      this.setScaleMode(incoming.scaleMode);
    }
    if (incoming.rotate !== undefined && incoming.rotate !== prevCfg.rotate) {
      this.setRotate(incoming.rotate);
    }
    if (incoming.volume !== undefined && incoming.volume !== prevCfg.volume) {
      this.setVolume(incoming.volume);
    }
    if (incoming.isMute !== undefined && incoming.isMute !== prevCfg.isMute) {
      if (incoming.isMute) this.mute();
      else this.cancelMute();
    }
    if (
      incoming.videoBuffer !== undefined &&
      incoming.videoBuffer !== prevCfg.videoBuffer
    ) {
      this.setBufferTime(incoming.videoBuffer);
    }

    // ---- 结构性配置 ----
    for (const key of Object.keys(incoming) as (keyof JessibucaConfig)[]) {
      if (STRUCTURAL_CONFIG_KEYS.has(key) && incoming[key] !== prevCfg[key]) {
        this.rebuildFlag = true;
        break;
      }
    }
  }

  setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error, isLoading: false }));
    if (error) this.dispatch('onError', new Error(error));
  }

  setRotate(deg: number) {
    this.instance?.setRotate(deg);
    this.store.setState((prev) => ({
      ...prev,
      config: { ...prev.config, rotate: deg },
    }));
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

  /**
   * 设置 url。
   * 只更新 store 和实例 _opt.url，不自动重播。
   * 重播由组件 watch 或用户显式调用 play() 触发，避免双份触发源。
   */
  setUrl(url: string) {
    this.store.setState((prev) => ({ ...prev, url, error: null }));
    this.syncUrlToInstance(url);
  }

  setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    this.instance?.setVolume(vol);
    this.store.setState((prev) => ({
      ...prev,
      volume: vol,
      config: { ...prev.config, volume: vol },
    }));
  }

  startRecord(fileName?: string, fileType?: string) {
    if (!this.instance) {
      const msg = '播放器尚未初始化，无法录制';
      this.setError(msg);
      throw new Error(msg);
    }

    if (!this.store.state.isPlaying) {
      const msg = '请先播放视频后再开始录制';
      this.setError(msg);
      throw new Error(msg);
    }
    this.instance.startRecord(fileName, fileType);
  }

  stopRecordAndSave() {
    if (!this.instance) return;
    if (!this.store.state.isRecording) return;
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
        this.dispatch('onPlay');
      },
      pause: () => {
        this.updatePlaying(false);
        this.dispatch('onPause');
      },
      loading: () => this.updateLoading(true),
      load: () => this.dispatch('onLoad'),
      videoInfo: (info: { width: number; height: number; encType: string }) => {
        this.store.setState((prev) => ({
          ...prev,
          videoWidth: info.width,
          videoHeight: info.height,
        }));
        this.dispatch('onVideoInfo', info);
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
        this.dispatch('onStats', stats);
      },
      error: (error: Error | string) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setError(message);
      },
      timeout: (error: string) => {
        this.setError(`播放超时: ${error}`);
        this.dispatch('onTimeout', error);
      },
      fullscreen: (isFullscreen: boolean) =>
        this.dispatch('onFullscreen', isFullscreen),
      mute: (isMuted: boolean) => {
        this.store.setState((prev) => ({
          ...prev,
          isMuted,
          config: { ...prev.config, isMute: isMuted },
        }));
        this.dispatch('onMute', isMuted);
      },
      recordStart: () => {
        this.store.setState((prev) => ({
          ...prev,
          isRecording: true,
          recordingDuration: 0,
        }));
        this.dispatch('onRecordStart');
      },
      recordEnd: (blob: Blob) => {
        this.store.setState((prev) => ({ ...prev, isRecording: false }));
        this.dispatch('onRecordEnd', blob);
      },
      recording: (duration: number) => {
        this.store.setState((prev) => ({
          ...prev,
          recordingDuration: duration,
        }));
        this.dispatch('onRecording', duration);
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      this.boundHandlers.set(event, handler);
      this.instance.on(event, handler);
    }
  }

  /** 统一分发：用户层先执行，组件层后执行 */
  private dispatch<K extends keyof JessibucaCallbacks>(
    name: K,
    ...args: Parameters<NonNullable<JessibucaCallbacks[K]>>
  ) {
    (this.userCallbacks[name] as any)?.(...args);
    (this.componentCallbacks[name] as any)?.(...args);
  }

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
