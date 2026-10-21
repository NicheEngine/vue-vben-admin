import type { LivePlayerApi } from '@vben/live-player';

import type { IPlayerApi, PlayerStats } from '../types';

import { ref } from 'vue';

export function createLiveAdapter(api: LivePlayerApi): IPlayerApi {
  const isPlaying = ref<boolean>(api.store.state.isPlaying ?? false);
  const isLoading = ref<boolean>(api.store.state.isLoading ?? false);
  const isReady = ref<boolean>(api.store.state.isReady ?? false);
  const error = ref<null | string>(api.store.state.error ?? null);
  const volume = ref<number>(api.store.state.volume ?? 1);
  const isMuted = ref<boolean>(api.store.state.muted ?? false);
  const currentTime = ref<number>(api.store.state.currentTime ?? 0);

  const videoWidth = ref<number>((api.store.state as any).videoWidth ?? 0);
  const videoHeight = ref<number>((api.store.state as any).videoHeight ?? 0);
  const networkDelay = ref<number>((api.store.state as any).networkDelay ?? 0);
  const stats = ref<PlayerStats>((api.store.state as any).stats ?? {});

  const isRecording = ref<boolean>(false);
  const recordingDuration = ref<number>(0);
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let recordTimer: null | ReturnType<typeof setInterval> = null;

  api.store.subscribe((state) => {
    isPlaying.value = state.isPlaying ?? false;
    isLoading.value = state.isLoading ?? false;
    isReady.value = state.isReady ?? false;
    error.value = state.error ?? null;
    volume.value = state.volume ?? 1;
    isMuted.value = state.muted ?? false;
    currentTime.value = state.currentTime ?? 0;

    videoWidth.value = (state as any).videoWidth ?? 0;
    videoHeight.value = (state as any).videoHeight ?? 0;
    networkDelay.value = (state as any).networkDelay ?? 0;
    if ((state as any).stats) stats.value = (state as any).stats;
  });

  const getVideoElement = (): HTMLVideoElement | null => {
    return (api as any).videoRef?.value || document.querySelector('video');
  };

  return {
    isPlaying,
    isLoading,
    isReady,
    error,
    volume,
    isMuted,
    videoWidth,
    videoHeight,
    currentTime,
    networkDelay,

    isRecording,
    recordingDuration,
    scaleMode: ref<0 | 1 | 2>(1),
    stats,

    capabilities: {
      screenshot: true,
      record: true,
      scaleMode: true, // 改为 true
      stats: true,
      seek: false,
      fullscreen: true,
    },

    play: async () => api.play(),
    pause: async () => api.pause(),
    toggle: async () => api.toggle(),
    setVolume: (v) => api.setVolume(v),
    setMuted: (m) => api.setMuted(m),
    setUrl: (u) => api.setUrl(u),
    seek: (t) => api.seek(t),
    destroy: async () => {
      if (recordTimer) clearInterval(recordTimer);
      api.destroy();
    },

    screenshot: (opts) => {
      const video = getVideoElement();
      if (!video) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas
        .getContext('2d')
        ?.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL(`image/${opts?.format || 'png'}`);
    },

    startRecord: () => {
      const video = getVideoElement();
      if (!video) return;

      const stream = (video as any).captureStream?.() as MediaStream;
      if (!stream) return;

      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recordedChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `live-record-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      mediaRecorder.start();

      isRecording.value = true;
      recordingDuration.value = 0;
      recordTimer = setInterval(() => {
        recordingDuration.value += 1000;
      }, 1000);
    },

    stopRecordAndSave: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording.value = false;
        if (recordTimer) clearInterval(recordTimer);
      }
    },

    setScaleMode: (mode: 0 | 1 | 2) => {
      const video = getVideoElement();
      if (video) {
        // 用 CSS object-fit 模拟缩放
        if (mode === 0)
          video.style.objectFit = 'fill'; // 拉伸
        else if (mode === 1)
          video.style.objectFit = 'contain'; // 等比留黑边
        else if (mode === 2) video.style.objectFit = 'cover'; // 等比裁切
      }
      // 同时更新 api store 里的状态
      (api.store as any).setState((prev: any) => ({
        ...prev,
        scaleMode: mode,
      }));
    },
  };
}
