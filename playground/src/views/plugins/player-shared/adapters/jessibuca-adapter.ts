import type { JessibucaPlayerApi } from '@vben/jessibuca-player';

import type { IPlayerApi, PlayerStats } from '../types';

import { computed, ref } from 'vue';

export function createJessibucaAdapter(api: JessibucaPlayerApi): IPlayerApi {
  const isPlaying = ref(api.store.state.isPlaying ?? false);
  const isLoading = ref(api.store.state.isLoading ?? false);
  const volume = ref(api.store.state.volume ?? 1);
  const isMuted = ref(api.store.state.isMuted ?? true);
  const scaleMode = ref((api.store.state.config.scaleMode ?? 1) as 0 | 1 | 2);

  const isRecording = ref(false);
  const recordingDuration = ref(0);

  const stats = ref<PlayerStats>({ buf: 0, fps: 0, abps: 0, vbps: 0, ts: 0 });
  const networkDelay = ref(0);
  const currentTime = ref(0);
  const videoWidth = ref(0);
  const videoHeight = ref(0);

  // 劫持底层事件（修复：将 ts 转为秒，并限制 buf 的合理范围）
  const prev = api.getCallbacks();
  api.setCallbacks({
    ...prev,
    onPlay: () => {
      isPlaying.value = true;
      isLoading.value = false;
      prev?.onPlay?.();
    },
    onPause: () => {
      isPlaying.value = false;
      prev?.onPause?.();
    },
    onLoad: () => {
      isLoading.value = false;
      prev?.onLoad?.();
    },
    onStats: (s) => {
      isLoading.value = false;
      stats.value = { ...s };
      networkDelay.value = Math.max(0, Math.min(s.buf || 0, 3000)); // 限制在 0-3秒内，防累加错误
      currentTime.value = (s.ts || 0) / 1000;
      prev?.onStats?.(s);
    },
    onVideoInfo: (info) => {
      videoWidth.value = info.width;
      videoHeight.value = info.height;
      prev?.onVideoInfo?.(info);
    },
    onRecordStart: () => {
      isRecording.value = true;
      recordingDuration.value = 0;
      prev?.onRecordStart?.();
    },
    onRecordEnd: (blob) => {
      isRecording.value = false;
      prev?.onRecordEnd?.(blob);
    },
    onRecording: (d) => {
      recordingDuration.value = d;
      prev?.onRecording?.(d);
    },
  });

  // 同步底层 store 变化
  api.store.subscribe((state) => {
    isPlaying.value = state.isPlaying;
    volume.value = state.volume;
    isMuted.value = state.isMuted;
    scaleMode.value = (state.config.scaleMode ?? 1) as 0 | 1 | 2;
    if (state.isLoading !== undefined) {
      isLoading.value = state.isLoading;
    }
  });

  return {
    isPlaying,
    isLoading,
    isReady: computed(() => !!api.getInstance() || isPlaying.value),
    error: computed(() => api.store.state.error ?? null),

    volume,
    isMuted,
    scaleMode,
    stats,
    networkDelay,
    currentTime,
    videoWidth,
    videoHeight,
    isRecording,
    recordingDuration,

    capabilities: {
      screenshot: true,
      record: true,
      scaleMode: true,
      stats: true,
      seek: false,
      fullscreen: true,
    },

    play: () => api.play(),
    pause: () => api.pause(),
    toggle: () => api.toggle(),
    setVolume: (v) => api.setVolume(v),
    setMuted: (m) => (m ? api.mute() : api.cancelMute()),
    setUrl: (u) => api.setUrl(u),

    // 👈 修复内存泄漏：在销毁时彻底断开订阅
    destroy: async () => {
      await api.destroy();
    },

    resize: () => api.resize(),
    screenshot: (opts) =>
      api.screenshot(opts?.filename, opts?.format, 1, opts?.type ?? 'base64'),
    setScaleMode: (m) => api.setScaleMode(m),
    startRecord: (n, t) => api.startRecord(n, t),
    stopRecordAndSave: () => api.stopRecordAndSave(),

    setLoading: (loading: boolean) => {
      isLoading.value = loading;
    },
  };
}
