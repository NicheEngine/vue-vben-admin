import type { IPlayerApi, PlayerStats } from '../types';

import { computed, ref } from 'vue';

/**
 * OSSRS 播放器适配器（骨架）。
 *
 * TODO: 把 `OssrsApi` 替换为实际的 OSSRS API 类型，例如：
 *   import type { SrsPlayerApi } from '@ossrs/srs-player';
 * 或
 *   import type { OssrsPlayerApi } from './ossrs-player-api';
 */
interface OssrsApi {
  store: {
    state: {
      isPlaying: boolean;
      isLoading: boolean;
      isReady: boolean;
      error: null | string;
      volume: number;
      muted: boolean;
      videoWidth: number;
      videoHeight: number;
      currentTime: number;
    };
  };
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  toggle: () => Promise<void> | void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setUrl: (u: string) => void;
  seek?: (t: number) => void;
  destroy: () => Promise<void> | void;
}

export function createOssrsAdapter(api: OssrsApi): IPlayerApi {
  const seekFn = api.seek;
  return {
    isPlaying: computed<boolean>(() => api.store.state.isPlaying ?? false),
    isLoading: computed<boolean>(() => api.store.state.isLoading ?? false),
    isReady: computed<boolean>(() => api.store.state.isReady ?? false),
    error: computed<null | string>(() => api.store.state.error ?? null),
    volume: computed<number>(() => api.store.state.volume ?? 1),
    isMuted: computed<boolean>(() => api.store.state.muted ?? false),
    videoWidth: computed<number>(() => api.store.state.videoWidth ?? 0),
    videoHeight: computed<number>(() => api.store.state.videoHeight ?? 0),
    currentTime: computed<number>(() => api.store.state.currentTime ?? 0),
    networkDelay: ref<number>(0),
    isRecording: ref<boolean>(false),
    recordingDuration: ref<number>(0),
    scaleMode: ref<0 | 1 | 2>(1),
    stats: ref<PlayerStats>({}),

    capabilities: {
      // TODO: 按实际库能力逐项开启
      screenshot: false,
      record: false,
      scaleMode: false,
      stats: false,
      seek: typeof seekFn === 'function',
      fullscreen: true,
    },

    play: async () => {
      await api.play();
    },
    pause: async () => {
      await api.pause();
    },
    toggle: async () => {
      await api.toggle();
    },
    setVolume: (v) => api.setVolume(v),
    setMuted: (m) => api.setMuted(m),
    setUrl: (u) => api.setUrl(u),
    seek: seekFn ? (t) => seekFn(t) : undefined,
    destroy: async () => {
      await api.destroy();
    },
  };
}
