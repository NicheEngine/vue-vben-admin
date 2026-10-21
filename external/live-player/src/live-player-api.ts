import type { Subscription } from '@vben-core/shared/store';

import type { LivePlayerApiOptions, LivePlayerStoreState } from './types';

import { createStore, Store } from '@vben-core/shared/store';
import { bindMethods } from '@vben-core/shared/utils';

const defaultHlsOptions = {
  enableWorker: true,
  lowLatencyMode: true,
  liveSyncDurationCount: 2,
  liveMaxLatencyDurationCount: 10,
  maxBufferLength: 8,
  maxMaxBufferLength: 10,
  maxLiveSyncPlaybackRate: 1.2,
  liveDurationInfinity: true,
};

const defaultMpegtsOptions = {
  config: { enableStashBuffer: false, liveSync: true },
  datasource: { type: 'flv', isLive: true },
};

function cloneDefaultHlsOptions() {
  return { ...defaultHlsOptions };
}

function cloneDefaultMpegtsOptions() {
  return {
    config: { ...defaultMpegtsOptions.config },
    datasource: { ...defaultMpegtsOptions.datasource },
  };
}

export class LivePlayerApi {
  public store: Store<LivePlayerStoreState>;

  private componentCallbacks: LivePlayerApiOptions = {};
  private prevState: LivePlayerStoreState;
  private subscribe: Subscription;
  private userCallbacks: LivePlayerApiOptions = {};

  constructor(options: LivePlayerApiOptions = {}) {
    const {
      onPlay,
      onPause,
      onError,
      onLoadStart,
      onLoadEnd,
      onReady,
      onTimeUpdate,
      onVolumeChange,
      onUrlChange,
      ...storeState
    } = options;

    const defaultState: LivePlayerStoreState = {
      url: '',
      autoplay: true,
      muted: false,
      controls: true,
      type: undefined,
      hlsOptions: cloneDefaultHlsOptions(),
      mpegtsOptions: cloneDefaultMpegtsOptions(),
      isPlaying: false,
      isLoading: false,
      isReady: false,
      error: null,
      volume: 1,
      currentTime: 0,
      videoWidth: 0,
      videoHeight: 0,
      networkDelay: 0,
      stats: null,
    };

    this.store = createStore<LivePlayerStoreState>({
      ...defaultState,
      ...storeState,
    });

    this.userCallbacks = {
      onPlay,
      onPause,
      onError,
      onLoadStart,
      onLoadEnd,
      onReady,
      onTimeUpdate,
      onVolumeChange,
      onUrlChange,
    };

    this.prevState = this.store.state;

    this.subscribe = this.store.subscribe(() => {
      const state = this.store.state;
      const prev = this.prevState;

      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying) this.emitUser('onPlay');
        else this.emitUser('onPause');
      }
      if (state.error !== prev.error && state.error) {
        this.emitUser('onError', new Error(state.error));
      }
      if (state.isLoading !== prev.isLoading) {
        if (state.isLoading) this.emitUser('onLoadStart');
        else this.emitUser('onLoadEnd');
      }
      if (state.isReady !== prev.isReady && state.isReady) {
        this.emitUser('onReady');
      }
      if (state.currentTime !== prev.currentTime) {
        this.emitUser('onTimeUpdate', state.currentTime);
      }
      if (state.volume !== prev.volume) {
        this.emitUser('onVolumeChange', state.volume);
      }
      if (state.url !== prev.url) {
        this.emitUser('onUrlChange', state.url);
      }

      this.prevState = state;
    });

    bindMethods(this);
  }

  destroy() {
    this.subscribe?.unsubscribe();
  }

  public getCallbacks(): Readonly<LivePlayerApiOptions> {
    return this.userCallbacks;
  }

  pause() {
    this.store.setState((prev) => ({ ...prev, isPlaying: false }));
  }

  play() {
    this.store.setState((prev) => ({ ...prev, isPlaying: true }));
  }

  seek(time: number) {
    this.store.setState((prev) => ({
      ...prev,
      currentTime: Math.max(0, time),
    }));
  }

  public setCallbacks(cb: LivePlayerApiOptions) {
    this.userCallbacks = { ...this.userCallbacks, ...cb };
  }

  public setComponentCallbacks(cb: LivePlayerApiOptions) {
    this.componentCallbacks = cb;
  }

  setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error }));
  }

  setLoading(loading: boolean) {
    if (this.store.state.isLoading !== loading) {
      this.store.setState((prev) => ({ ...prev, isLoading: loading }));
    }
  }

  setMuted(muted: boolean) {
    this.store.setState((prev) => ({ ...prev, muted }));
  }

  setUrl(url: string) {
    this.store.setState((prev) => ({ ...prev, url, error: null }));
  }

  setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    this.store.setState((prev) => ({ ...prev, volume: vol }));
  }

  toggle() {
    if (this.store.state.isPlaying) this.pause();
    else this.play();
  }

  toggleMuted() {
    this.store.setState((prev) => ({ ...prev, muted: !prev.muted }));
  }

  updateCurrentTime(time: number) {
    if (Math.abs(this.store.state.currentTime - time) > 0.1) {
      this.store.setState((prev) => ({ ...prev, currentTime: time }));
    }
  }

  updatePlaying(playing: boolean) {
    if (this.store.state.isPlaying !== playing) {
      this.store.setState((prev) => ({ ...prev, isPlaying: playing }));
    }
  }

  updateReady(ready: boolean) {
    if (this.store.state.isReady !== ready) {
      this.store.setState((prev) => ({ ...prev, isReady: ready }));
    }
  }

  updateStats(stats: any) {
    this.store.setState((prev) => ({
      ...prev,
      stats,
      networkDelay: stats.buf || 0,
    }));
  }

  updateVideoSize(width: number, height: number) {
    this.store.setState((prev) => ({
      ...prev,
      videoWidth: width,
      videoHeight: height,
    }));
  }

  private emitUser<
    K extends keyof Omit<LivePlayerApiOptions, keyof LivePlayerStoreState>,
  >(key: K, ...args: any[]) {
    (this.userCallbacks[key] as any)?.(...args);
    (this.componentCallbacks[key] as any)?.(...args);
  }
}
