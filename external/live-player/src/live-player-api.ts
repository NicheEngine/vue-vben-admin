import type { Subscription } from '@vben-core/shared/store';

import type {
  LivePlayerApiOptions,
  LivePlayerProps,
  LivePlayerState,
  LivePlayerStoreState,
} from './types';

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

  private api: Pick<
    LivePlayerApiOptions,
    | 'onError'
    | 'onLoadEnd'
    | 'onLoadStart'
    | 'onPause'
    | 'onPlay'
    | 'onReady'
    | 'onTimeUpdate'
    | 'onUrlChange'
    | 'onVolumeChange'
  >;

  private state: LivePlayerStoreState;
  private subscribe: Subscription;

  constructor(options: LivePlayerApiOptions = {}) {
    const {
      connectedComponent: _,
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
      error: null,
      volume: 1,
      currentTime: 0,
      isReady: false,
    };

    this.store = createStore<LivePlayerProps & LivePlayerState>({
      ...defaultState,
      ...storeState,
    });

    // 先赋值 api 和 state，再订阅，避免回调里读到 undefined
    this.api = {
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
    this.state = this.store.state;

    this.subscribe = this.store.subscribe(() => {
      const state = this.store.state;
      const prev = this.state;

      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying) this.api.onPlay?.();
        else this.api.onPause?.();
      }
      if (state.error !== prev.error && state.error) {
        this.api.onError?.(new Error(state.error));
      }
      if (state.isLoading !== prev.isLoading) {
        if (state.isLoading) this.api.onLoadStart?.();
        else this.api.onLoadEnd?.();
      }
      if (state.isReady !== prev.isReady && state.isReady) {
        this.api.onReady?.();
      }
      if (state.currentTime !== prev.currentTime) {
        this.api.onTimeUpdate?.(state.currentTime);
      }
      if (state.volume !== prev.volume) {
        this.api.onVolumeChange?.(state.volume);
      }
      if (state.url !== prev.url) {
        this.api.onUrlChange?.(state.url);
      }
      this.state = state;
    });

    bindMethods(this);
  }

  destroy() {
    this.subscribe?.unsubscribe();
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

  setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error }));
  }

  setLoading(loading: boolean) {
    this.store.setState((prev) => ({ ...prev, isLoading: loading }));
  }

  setUrl(url: string) {
    this.store.setState((prev) => ({ ...prev, url, error: null }));
  }

  setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    this.store.setState((prev) => ({ ...prev, volume: vol }));
  }

  toggle() {
    // 读 store 最新状态，而不是订阅快照
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
}
