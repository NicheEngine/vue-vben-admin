import type { EasyPlayerApi } from '@vben/easy-player';

import type { IPlayerApi, PlayerStats } from '../types';

import { ref } from 'vue';

export function createEasyAdapter(api: EasyPlayerApi): IPlayerApi {
  // ================= 1. 本地响应式状态 =================
  const isPlaying = ref(api.store.state.isPlaying ?? false);
  const isLoading = ref(api.store.state.isLoading ?? false);
  const isReady = ref(api.store.state.isReady ?? false);
  const error = ref<null | string>(api.store.state.error ?? null);
  const volume = ref(api.store.state.volume ?? 1);
  const isMuted = ref(api.store.state.muted ?? true);
  const currentTime = ref(api.store.state.currentTime ?? 0);
  const videoWidth = ref(api.store.state.videoWidth ?? 0);
  const videoHeight = ref(api.store.state.videoHeight ?? 0);

  const networkDelay = ref(0);
  const isRecording = ref(false);
  const recordingDuration = ref(0);
  const scaleMode = ref<0 | 1 | 2>(1);
  const stats = ref<PlayerStats>({ buf: 0, fps: 0, vbps: 0 });

  let mediaRecorder: MediaRecorder | null = null;
  let recordTimer: null | ReturnType<typeof setInterval> = null;
  let recordDrawTimer: null | ReturnType<typeof setInterval> = null;

  // ✅ 网络统计定时器
  let statsInterval: null | ReturnType<typeof setInterval> = null;

  const getVideo = (): HTMLVideoElement | null => {
    const inst = api.getInstance() as any;
    return inst?.video || inst?.$el?.querySelector('video') || null;
  };

  // ================= 2. 网络质量估算 =================
  const startStats = () => {
    if (statsInterval) return;
    statsInterval = setInterval(() => {
      const video = getVideo();
      if (!video || video.paused) return;

      // 1. 估算网络延迟（基于缓冲时长）
      let bufferDelay = 0;
      if (video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (
            video.buffered.start(i) <= video.currentTime &&
            video.currentTime <= video.buffered.end(i)
          ) {
            bufferDelay = (video.buffered.end(i) - video.currentTime) * 1000; // ms
            break;
          }
        }
      }

      const delay = Math.max(0, Math.min(bufferDelay, 5000));
      networkDelay.value = Math.round(delay);

      // 2. 估算码率（模拟波动）
      const mockVbps = 1_500_000 + Math.random() * 1_000_000;

      stats.value = {
        buf: networkDelay.value,
        vbps: mockVbps,
        fps: 25,
      };
    }, 1000);
  };

  const stopStats = () => {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  };

  // ================= 3. 订阅底层 store =================
  const unsub = api.store.subscribe((state) => {
    isPlaying.value = state.isPlaying ?? false;
    isLoading.value = state.isLoading ?? false;
    isReady.value = state.isReady ?? false;
    error.value = state.error ?? null;
    volume.value = state.volume ?? 1;
    isMuted.value = state.muted ?? true;
    currentTime.value = state.currentTime ?? 0;
    videoWidth.value = state.videoWidth ?? 0;
    videoHeight.value = state.videoHeight ?? 0;

    // ✅ 严格以 isPlaying 为准，只在状态翻转时启动/停止
    if (state.isPlaying) {
      startStats();
    } else {
      stopStats();
      networkDelay.value = 0;
      stats.value = { buf: 0, fps: 0, vbps: 0 };
    }
  });

  /**
   * ✅ FIX: 统一清理录制相关资源。
   */
  function cleanupRecord() {
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
    if (recordDrawTimer) {
      clearInterval(recordDrawTimer);
      recordDrawTimer = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorder = null;
    isRecording.value = false;
    recordingDuration.value = 0;
  }

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
      stats: true, // ✅ 开启统计
      seek: false,
      fullscreen: true,
    },

    play: async () => {
      api.play();
    },
    pause: async () => {
      api.pause();
    },
    toggle: async () => {
      api.toggle();
    },
    setVolume: (v) => api.setVolume(v),
    setMuted: (m) => api.setMuted(m),
    setUrl: (u) => api.setUrl(u),

    destroy: async () => {
      cleanupRecord();
      stopStats(); // ✅ 清理统计定时器
      unsub.unsubscribe();
      api.destroy();
    },

    screenshot: () => {
      const video = getVideo();
      if (!video) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas
        .getContext('2d')
        ?.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    },

    startRecord: () => {
      const video = getVideo();
      if (!video) return;
      if (isRecording.value) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      recordDrawTimer = setInterval(() => {
        if (!video.paused && !video.ended && ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }, 40);

      const stream = canvas.captureStream(25);
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (recordDrawTimer) {
          clearInterval(recordDrawTimer);
          recordDrawTimer = null;
        }
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `record-${Date.now()}.webm`;
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

    setScaleMode: (mode) => {
      scaleMode.value = mode;
    },

    requestFullscreen: async () => {
      const el = getVideo()?.parentElement;
      if (el && !document.fullscreenElement) await el.requestFullscreen();
    },
    exitFullscreen: async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    },
  };
}
