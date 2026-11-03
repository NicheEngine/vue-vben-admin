import type { Store } from '@vben-core/shared/store';

import type {
  EasyPlayerApiOptions,
  EasyPlayerCallbacks,
  EasyPlayerInstance,
  EasyPlayerStoreState,
} from './types';

import { createStore } from '@vben-core/shared/store';
import { bindMethods } from '@vben-core/shared/utils';

const STRUCTURAL_CONFIG_KEYS = new Set<keyof EasyPlayerStoreState>([
  'decodeType',
  'isH265',
  'isTransCoding',
  'live',
]);

function createDefaultState(): EasyPlayerStoreState {
  return {
    alt: '无信号',
    aspect: '16:9',
    autoplay: true,
    currentTime: 0,
    debug: false,
    decodeType: 'auto',
    easyStretch: false,
    error: null,
    hasAudio: true,
    hiddenRightMenu: false,
    iceServers: [],
    isH265: false,
    isLoading: false,
    isPlaying: false,
    isReady: false,
    isTransCoding: false,
    live: true,
    loop: false,
    muted: true,
    playerStyle: 'width: 100%;height: 100%;',
    poster: '',
    progress: false,
    reconnection: true,
    recordFileName: '',
    recordMaxFileSize: 200,
    remoteHost: '',
    resolution: 'hd',
    resolutionDefault: 'hd',
    restartTime: 60 * 60 * 6,
    scaleMode: 1,
    keepPlayingOffscreen: false,
    showEnterprise: true,
    showCustomButton: true,
    url: '',
    videoHeight: 0,
    videoTitle: '',
    videoUrl: '',
    videoWidth: 0,
    volume: 1,
    watermark: undefined,
  } as EasyPlayerStoreState;
}

export class EasyPlayerApi {
  public store: Store<EasyPlayerStoreState>;

  private componentCallbacks: EasyPlayerCallbacks = {};
  private containerEl: HTMLElement | null = null;
  private instance: EasyPlayerInstance | null = null;
  private isForcingStyle = false;

  private isReplaying = false;
  private rebuildFlag = false;
  private resizeObserver: null | ResizeObserver = null;
  private styleObserver: MutationObserver | null = null;

  private userCallbacks: EasyPlayerCallbacks = {};
  private videoEl: HTMLVideoElement | null = null;

  constructor(options: EasyPlayerApiOptions = {}) {
    const {
      onEnded,
      onError,
      onPause,
      onPlay,
      onRecording,
      onSnapshot,
      onTimeUpdate,
      ...storeState
    } = options;

    this.userCallbacks = {
      onEnded,
      onError,
      onPause,
      onPlay,
      onRecording,
      onSnapshot,
      onTimeUpdate,
    };

    this.store = createStore<EasyPlayerStoreState>({
      ...createDefaultState(),
      ...storeState,
    });

    bindMethods(this);
  }

  bindContainer(el: HTMLElement | null) {
    if (this.containerEl === el) return;
    this.destroyStyleGuard();
    this.containerEl = el;
    if (el) this.setupStyleGuard(el);
  }

  bindInstance(instance: EasyPlayerInstance | null) {
    this.instance = instance;
    if (instance) {
      this.updateReady(true);
      this.applyFit();
    }
  }

  clearRebuildFlag() {
    this.rebuildFlag = false;
  }

  destroy() {
    this.destroyPlayer();
    this.destroyStyleGuard();
    this.containerEl = null;
  }

  destroyPlayer() {
    try {
      this.instance?.destroyPlayer?.();
    } catch (error) {
      console.warn('[EasyPlayerApi] destroyPlayer error:', error);
    }
    this.instance = null;
    this.updatePlaying(false);
    this.updateReady(false);
    this.store.setState((prev) => ({ ...prev, isLoading: false, error: null }));
  }

  exitFullscreen() {
    this.instance?.exitFullscreen?.();
  }
  fullscreen() {
    this.instance?.fullscreen?.();
  }
  getCallbacks(): Readonly<EasyPlayerCallbacks> {
    return { ...this.userCallbacks };
  }
  getInstance(): EasyPlayerInstance | null {
    return this.instance;
  }
  initPlayer() {
    this.instance?.initPlayer?.();
  }
  needsRebuild(): boolean {
    return this.rebuildFlag;
  }

  public pause() {
    const video = this.containerEl?.querySelector('video');
    if (video && !video.paused) {
      video.pause();
    }
    this.updatePlaying(false);
  }

  public play() {
    const video = this.containerEl?.querySelector('video');
    this.store.setState((prev) => ({ ...prev, error: null, isLoading: false }));

    if (video && video.paused) {
      video.play().catch((error) => console.warn('Play interrupted:', error));
    }
    this.updatePlaying(true);
  }

  async replay() {
    if (this.isReplaying) return;
    this.isReplaying = true;

    this.store.setState((prev) => ({ ...prev, error: null, isLoading: true }));
    this.updatePlaying(false);

    try {
      const inst = this.instance as any;
      if (inst && typeof inst.restartPlayer === 'function') {
        inst.restartPlayer();
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        const video = this.containerEl?.querySelector('video');
        if (video && this.store.state.url) {
          video.load();
          await video.play().catch(() => {});
        }
      }
    } catch (error) {
      console.warn('[EasyPlayerApi] replay error:', error);
    } finally {
      this.isReplaying = false;
    }
  }

  seek(time: number) {
    this.store.setState((prev) => ({
      ...prev,
      currentTime: Math.max(0, time),
    }));
  }

  setComponentCallbacks(callbacks: EasyPlayerCallbacks) {
    this.componentCallbacks = callbacks;
  }

  setConfig(partial: Partial<EasyPlayerStoreState>) {
    const prev = this.store.state;
    this.store.setState((s) => ({ ...s, ...partial }));

    if (partial.muted !== undefined && partial.muted !== prev.muted)
      this.setMuted(partial.muted);
    if (partial.volume !== undefined && partial.volume !== prev.volume)
      this.setVolume(partial.volume);
    if (
      partial.currentTime !== undefined &&
      partial.currentTime !== prev.currentTime
    )
      this.seek(partial.currentTime);
    if (partial.scaleMode !== undefined && partial.scaleMode !== prev.scaleMode)
      this.setScaleMode(partial.scaleMode);
    if (partial.keepPlayingOffscreen !== undefined)
      this.setKeepPlayingOffscreen(partial.keepPlayingOffscreen);

    for (const key of Object.keys(partial) as (keyof EasyPlayerStoreState)[]) {
      if (STRUCTURAL_CONFIG_KEYS.has(key) && partial[key] !== prev[key]) {
        this.rebuildFlag = true;
        break;
      }
    }
  }

  setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error, isLoading: false }));
    if (error) this.dispatch('onError', new Error(error));
  }

  // ✅ 新增：设置离屏播放配置
  setKeepPlayingOffscreen(enabled: boolean) {
    this.store.setState((prev) => ({ ...prev, keepPlayingOffscreen: enabled }));
  }

  setLoading(loading: boolean) {
    if (this.store.state.isLoading === loading) return;
    this.store.setState((prev) => ({ ...prev, isLoading: loading }));
  }

  setMuted(muted: boolean) {
    const prevMuted = this.store.state.muted;
    if (prevMuted === muted) return;
    this.store.setState((prev) => ({ ...prev, muted }));
    this.instance?.switchAudio?.();
  }

  setScaleMode(mode: 0 | 1 | 2) {
    this.store.setState((prev) => ({ ...prev, scaleMode: mode }));
    this.applyFit();
  }

  setUrl(url: string) {
    const prev = this.store.state.url;
    this.store.setState((p) => ({
      ...p,
      error: null,
      isLoading: true,
      url,
      videoUrl: url,
    }));
    if (prev === url) return;
    this.instance?.restartPlayer?.();
  }

  setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    this.store.setState((prev) => ({ ...prev, volume: vol }));
    if (vol === 0 && !this.store.state.muted) this.setMuted(true);
    else if (vol > 0 && this.store.state.muted) this.setMuted(false);
  }

  async snapshot() {
    try {
      const result = await Promise.resolve(this.instance?.snapshot?.());
      this.dispatch('onSnapshot');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(message);
      return undefined;
    }
  }

  switchAudio() {
    this.instance?.switchAudio?.();
  }

  switchRecording() {
    try {
      this.instance?.switchRecording?.();
      this.dispatch('onRecording');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(message);
    }
  }

  toggle() {
    if (this.store.state.isPlaying) this.pause();
    else this.play();
  }

  updateCurrentTime(time: number) {
    if (Math.abs(this.store.state.currentTime - time) > 0.1) {
      this.store.setState((prev) => ({ ...prev, currentTime: time }));
      this.dispatch('onTimeUpdate', time);
    }
  }

  updateEnded() {
    this.store.setState((prev) => ({ ...prev, isPlaying: false }));
    this.dispatch('onEnded');
  }

  updatePlaying(playing: boolean) {
    if (this.store.state.isPlaying !== playing) {
      this.store.setState((prev) => ({
        ...prev,
        isPlaying: playing,
        isLoading: playing ? false : prev.isLoading,
      }));
      if (playing) this.dispatch('onPlay');
      else this.dispatch('onPause');
    }
  }

  updateReady(ready: boolean) {
    if (this.store.state.isReady !== ready) {
      this.store.setState((prev) => ({ ...prev, isReady: ready }));
    }
  }

  updateVideoSize(width: number, height: number) {
    if (
      this.store.state.videoWidth !== width ||
      this.store.state.videoHeight !== height
    ) {
      this.store.setState((prev) => ({
        ...prev,
        videoWidth: width,
        videoHeight: height,
      }));
    }
  }

  private applyFit() {
    if (!this.containerEl) return;
    const { scaleMode } = this.store.state;

    let fit = 'contain';
    if (scaleMode === 0) fit = 'fill';
    else if (scaleMode === 2) fit = 'cover';

    this.containerEl.style.setProperty('--easy-player-fit', fit);
    this.forceStyle(fit);
  }

  private destroyStyleGuard() {
    if (this.styleObserver) {
      this.styleObserver.disconnect();
      this.styleObserver = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.videoEl = null;
  }

  private dispatch<K extends keyof EasyPlayerCallbacks>(
    name: K,
    ...args: Parameters<NonNullable<EasyPlayerCallbacks[K]>>
  ) {
    try {
      (this.userCallbacks[name] as any)?.(...args);
    } catch (error) {
      console.warn(`[EasyPlayerApi] user callback "${name}" error:`, error);
    }
    try {
      (this.componentCallbacks[name] as any)?.(...args);
    } catch (error) {
      console.warn(
        `[EasyPlayerApi] component callback "${name}" error:`,
        error,
      );
    }
  }

  private forceStyle(fitStr?: string) {
    if (!this.containerEl || this.isForcingStyle) return;

    try {
      this.isForcingStyle = true;
      this.videoEl = this.containerEl.querySelector('video');
      const wrapper = this.containerEl.querySelector(
        '.video-js',
      ) as HTMLElement;

      const { scaleMode } = this.store.state;
      let targetFit = fitStr;
      if (!targetFit) {
        if (scaleMode === 0) targetFit = 'fill';
        else if (scaleMode === 2) targetFit = 'cover';
        else targetFit = 'contain';
      }

      if (
        this.videoEl &&
        this.videoEl.style.getPropertyValue('object-fit') !== targetFit
      ) {
        this.videoEl.style.setProperty('width', '100%', 'important');
        this.videoEl.style.setProperty('height', '100%', 'important');
        this.videoEl.style.setProperty('object-fit', targetFit, 'important');
        this.videoEl.style.setProperty('position', 'absolute', 'important');
        this.videoEl.style.setProperty('top', '0', 'important');
        this.videoEl.style.setProperty('left', '0', 'important');
        this.videoEl.style.setProperty('transform', 'none', 'important');
      }

      if (wrapper && wrapper.style.getPropertyValue('padding-top') !== '0px') {
        wrapper.style.setProperty('padding-top', '0', 'important');
        wrapper.style.setProperty('width', '100%', 'important');
        wrapper.style.setProperty('height', '100%', 'important');
        wrapper.style.setProperty('position', 'absolute', 'important');
        wrapper.style.setProperty('top', '0', 'important');
        wrapper.style.setProperty('left', '0', 'important');
      }
    } finally {
      setTimeout(() => {
        this.isForcingStyle = false;
      }, 0);
    }
  }

  private setupStyleGuard(el: HTMLElement) {
    setTimeout(() => this.applyFit(), 100);
    setTimeout(() => this.applyFit(), 500);

    this.resizeObserver = new ResizeObserver(() => this.forceStyle());
    this.resizeObserver.observe(el);

    const attachObserver = () => {
      this.videoEl = el.querySelector('video');
      if (this.videoEl) {
        this.styleObserver = new MutationObserver((mutations) => {
          if (this.isForcingStyle) return;
          const hasStyleChange = mutations.some(
            (m) => m.type === 'attributes' && m.attributeName === 'style',
          );
          if (hasStyleChange) {
            const fit = this.videoEl?.style.objectFit;
            let targetFit = 'contain';
            if (this.store.state.scaleMode === 0) targetFit = 'fill';
            else if (this.store.state.scaleMode === 2) targetFit = 'cover';

            if (fit && fit !== targetFit && !fit.includes('var(')) {
              this.forceStyle();
            }
          }
        });
        this.styleObserver.observe(this.videoEl, {
          attributes: true,
          attributeFilter: ['style'],
        });
      } else {
        setTimeout(attachObserver, 100);
      }
    };
    attachObserver();
  }
}
