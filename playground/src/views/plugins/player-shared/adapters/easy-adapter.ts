import type { IPlayerApi, PlayerStats } from '../types';

import { computed, ref } from 'vue';

/**
 * EasyPlayer 适配器（骨架）。
 *
 * TODO: 把 `EasyApi` 替换为实际的 EasyPlayer API 类型，例如：
 *   import type { EasyPlayerApi } from '@easydarwin/easyplayer';
 * 或
 *   import type { EasyPlayerApi } from './easy-player-api';
 */
interface EasyApi {
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
  screenshot?: (opts?: {
    filename?: string;
    format?: 'jpeg' | 'png' | 'webp';
    type?: 'base64' | 'blob' | 'download';
  }) => Blob | string | undefined;
  startRecord?: (name?: string, type?: string) => void;
  stopRecordAndSave?: () => void;
  destroy: () => Promise<void> | void;
}

export function createEasyAdapter(api: EasyApi): IPlayerApi {
  const seekFn = api.seek;
  const screenshotFn = api.screenshot;
  const startRecordFn = api.startRecord;
  const stopRecordFn = api.stopRecordAndSave;

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
      screenshot: typeof screenshotFn === 'function',
      record:
        typeof startRecordFn === 'function' &&
        typeof stopRecordFn === 'function',
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
    screenshot: screenshotFn ? (opts) => screenshotFn(opts) : undefined,
    startRecord: startRecordFn ? (n, t) => startRecordFn(n, t) : undefined,
    stopRecordAndSave: stopRecordFn ? () => stopRecordFn() : undefined,
    destroy: async () => {
      await api.destroy();
    },
  };
}
