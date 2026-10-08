import type { Store } from '@vben-core/shared/store';

import type {
  EasyPlayerApiOptions,
  EasyPlayerCallbacks,
  EasyPlayerInstance,
  EasyPlayerStoreState,
} from './types';

import { createStore } from '@vben-core/shared/store';
import { bindMethods } from '@vben-core/shared/utils';

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
    showEnterprise: true,
    url: '',
    videoTitle: '',
    videoUrl: '',
    volume: 1,
    watermark: undefined,
  } as EasyPlayerStoreState;
}

export class EasyPlayerApi {
  public store: Store<EasyPlayerStoreState>;

  private callbacks: EasyPlayerCallbacks;
  private instance: EasyPlayerInstance | null = null;

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

    this.callbacks = {
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

  bindInstance(instance: EasyPlayerInstance | null) {
    this.instance = instance;
  }

  destroy() {
    this.destroyPlayer();
  }

  destroyPlayer() {
    this.instance?.destroyPlayer?.();
    this.instance = null;
  }

  exitFullscreen() {
    this.instance?.exitFullscreen?.();
  }

  fullscreen() {
    this.instance?.fullscreen?.();
  }

  initPlayer() {
    this.instance?.initPlayer?.();
  }

  pause() {
    this.instance?.switchVideo?.();
    this.updatePlaying(false);
  }

  play() {
    this.instance?.switchVideo?.();
    this.updatePlaying(true);
  }

  replay() {
    this.instance?.restartPlayer?.();
  }

  seek(time: number) {
    this.store.setState((prev) => ({
      ...prev,
      currentTime: Math.max(0, time),
    }));
  }

  setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error }));
    if (error) {
      this.callbacks.onError?.(new Error(error));
    }
  }

  setLoading(loading: boolean) {
    this.store.setState((prev) => ({ ...prev, isLoading: loading }));
  }

  setMuted(muted: boolean) {
    this.store.setState((prev) => ({ ...prev, muted }));
    this.instance?.switchAudio?.();
  }

  setUrl(url: string) {
    this.store.setState((prev) => ({
      ...prev,
      error: null,
      url,
      videoUrl: url,
    }));
    this.instance?.restartPlayer?.();
  }

  setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    this.store.setState((prev) => ({ ...prev, volume: vol }));
  }

  snapshot() {
    this.instance?.snapshot?.();
    this.callbacks.onSnapshot?.();
  }

  switchAudio() {
    this.instance?.switchAudio?.();
  }

  switchRecording() {
    this.instance?.switchRecording?.();
    this.callbacks.onRecording?.();
  }

  toggle() {
    if (this.store.state.isPlaying) this.pause();
    else this.play();
  }

  updateCurrentTime(time: number) {
    if (Math.abs(this.store.state.currentTime - time) > 0.1) {
      this.store.setState((prev) => ({ ...prev, currentTime: time }));
      this.callbacks.onTimeUpdate?.(time);
    }
  }

  updateEnded() {
    this.store.setState((prev) => ({ ...prev, isPlaying: false }));
    this.callbacks.onEnded?.();
  }

  updatePlaying(playing: boolean) {
    if (this.store.state.isPlaying !== playing) {
      this.store.setState((prev) => ({ ...prev, isPlaying: playing }));
      if (playing) this.callbacks.onPlay?.();
      else this.callbacks.onPause?.();
    }
  }

  updateReady(ready: boolean) {
    if (this.store.state.isReady !== ready) {
      this.store.setState((prev) => ({ ...prev, isReady: ready }));
    }
  }
}
