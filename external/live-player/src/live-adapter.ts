import type { LivePlayerApi } from '@vben/live-player';
import type { IPlayerApi, PlayerStats } from '@vben/player-types';

import { ref, watch } from 'vue';

import { normalizeStats, safeUnsubscribe } from '@vben/player-types';

export function createLiveAdapter(api: LivePlayerApi): IPlayerApi {
  const isPlaying = ref(api.store.state.isPlaying ?? false);
  const isLoading = ref(api.store.state.isLoading ?? false);
  const isReady = ref(api.store.state.isReady ?? false);
  const error = ref<null | string>(api.store.state.error ?? null);
  const volume = ref(api.store.state.volume ?? 1);
  const isMuted = ref(api.store.state.muted ?? false);
  const currentTime = ref(api.store.state.currentTime ?? 0);
  const videoWidth = ref(api.store.state.videoWidth ?? 0);
  const videoHeight = ref(api.store.state.videoHeight ?? 0);
  const networkDelay = ref(api.store.state.networkDelay ?? 0);
  const stats = ref<PlayerStats>(api.store.state.stats ?? {});

  const scaleMode = ref<0 | 1 | 2>(1);
  const isRecording = ref<boolean>(false);
  const recordingDuration = ref<number>(0);

  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let recordTimer: null | ReturnType<typeof setInterval> = null;

  let lastErrorTime = 0;
  const handleError = (msg: null | string) => {
    if (!msg) return;
    const now = Date.now();
    if (now - lastErrorTime > 2000) {
      error.value = msg;
      lastErrorTime = now;
    }
  };

  const unsub = api.store.subscribe((state) => {
    isPlaying.value = state.isPlaying ?? false;
    isLoading.value = state.isLoading ?? false;
    isReady.value = state.isReady ?? false;
    volume.value = state.volume ?? 1;
    isMuted.value = state.muted ?? false;
    currentTime.value = state.currentTime ?? 0;
    videoWidth.value = state.videoWidth ?? 0;
    videoHeight.value = state.videoHeight ?? 0;

    if (state.error) {
      handleError(state.error);
    } else {
      error.value = null;
    }

    // 归一化 stats
    const normalized = normalizeStats(state.stats ?? {});
    stats.value = normalized;
    networkDelay.value = normalized.buf ?? 0;
  });

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
    scaleMode,
    stats,

    capabilities: {
      screenshot: true,
      record: true,
      scaleMode: true,
      stats: true,
      seek: false,
      fullscreen: true,
    },

    play: async () => api.play(),
    pause: async () => api.pause(),
    toggle: async () => api.toggle(),
    setVolume: (v) => api.setVolume(v),
    setMuted: (m) => api.setMuted(m),
    setUrl: (u) => {
      error.value = null;
      lastErrorTime = 0;
      if (!u) {
        isPlaying.value = false;
        isLoading.value = false;
        isReady.value = false;
        currentTime.value = 0;
        networkDelay.value = 0;
        stats.value = { buf: 0, fps: 0, abps: 0, vbps: 0, ts: 0 };
      }
      api.setUrl(u);
    },
    setUrlAsync: async (u) => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(), 5000);
        const unwatch = watch(
          () => api.store.state.isReady,
          (ready) => {
            if (ready) {
              clearTimeout(timer);
              unwatch();
              resolve();
            }
          },
        );
        api.setUrl(u);
      });
    },
    destroy: async () => {
      safeUnsubscribe(unsub);
      if (recordTimer) {
        clearInterval(recordTimer);
        recordTimer = null;
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder = null;
      }
      api.destroy();
    },

    // 标准修复：直接暴露底层 api.video
    getVideoElement: () => api.video,

    setScaleMode: (mode: 0 | 1 | 2) => {
      scaleMode.value = mode;
      const video = api.video;
      if (video) {
        const fitMap: Record<0 | 1 | 2, string> = {
          0: 'fill',
          1: 'contain',
          2: 'cover',
        };
        video.style.objectFit = fitMap[mode];
      }
    },

    screenshot: (opts) => {
      const video = api.video;
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
      const video = api.video;
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
        if (recordTimer) {
          clearInterval(recordTimer);
          recordTimer = null;
        }
      }
    },

    // 标准全屏实现
    requestFullscreen: async () => {
      const el = api.video?.parentElement;
      if (el && !document.fullscreenElement) {
        await el.requestFullscreen();
      }
    },
    exitFullscreen: async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    },
  };
}
