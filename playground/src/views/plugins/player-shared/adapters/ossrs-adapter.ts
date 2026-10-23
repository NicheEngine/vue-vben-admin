import type { OssrsPlayerApi } from '@vben/ossrs-player';

import type { IPlayerApi, PlayerStats } from '../types';

import { computed, ref } from 'vue';

export function createOssrsAdapter(
  api: OssrsPlayerApi,
  defaultProtocol: 'rtc' | 'whep' = 'rtc',
): IPlayerApi {
  const isPlaying = computed(() => api.store.state.isPlaying);
  const isLoading = computed(() => api.store.state.isLoading);
  const isReady = computed(() => api.store.state.isReady);
  const error = computed(() => api.store.state.error);
  const isMuted = computed(() => api.store.state.muted);
  const volume = computed(() => api.store.state.volume);
  const currentTime = computed(() => api.store.state.currentTime);
  const videoWidth = computed(() => api.store.state.videoWidth);
  const videoHeight = computed(() => api.store.state.videoHeight);

  const networkDelay = ref(0);
  const isRecording = ref(false);
  const recordingDuration = ref(0);
  const scaleMode = ref<0 | 1 | 2>(1);
  const stats = ref<PlayerStats>({});
  let lastUrl = '';

  return {
    isPlaying,
    isLoading,
    isReady,
    error,
    isMuted,
    volume,
    videoWidth,
    videoHeight,
    currentTime,
    networkDelay,
    isRecording,
    recordingDuration,
    scaleMode,
    stats,

    capabilities: {
      screenshot: false,
      record: false,
      scaleMode: false,
      stats: false,
      seek: false,
      fullscreen: true,
    },

    play: async () => {
      await (lastUrl ? api.play(lastUrl, defaultProtocol) : api.toggle());
    },
    pause: async () => {
      api.pause();
    },
    toggle: async () => {
      api.toggle();
    },
    setVolume: (v) => api.setVolume(v),
    setMuted: (m) => api.setMuted(m),
    setUrl: (u) => {
      lastUrl = u;
      api.play(u, defaultProtocol);
    },
    destroy: async () => {
      api.destroy();
      lastUrl = '';
    },
  };
}
