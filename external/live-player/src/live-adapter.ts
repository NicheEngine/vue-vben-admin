import type { LivePlayerApi } from '@vben/live-player';
import type { IPlayerApiFull, PlayerStats } from '@vben/player-types';

import { ref, watch } from 'vue';

import { normalizeStats, safeUnsubscribe } from '@vben/player-types';

export function createLiveAdapter(api: LivePlayerApi): IPlayerApiFull {
  const isPlaying = ref(api.store.state.isPlaying ?? false);
  const isLoading = ref(api.store.state.isLoading ?? false);
  const isReady = ref(api.store.state.isReady ?? false);
  const error = ref<null | string>(api.store.state.error ?? null);
  const volume = ref(api.store.state.volume ?? 1);
  const isMuted = ref(api.store.state.muted ?? true);
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
      pip: true,
      keepPlayingOffscreen: false,
    },

    togglePiP: async () => {
      const video = api.video;
      if (!video) return;
      try {
        await (document.pictureInPictureElement
          ? document.exitPictureInPicture()
          : video.requestPictureInPicture());
      } catch (error) {
        console.warn('[LivePlayer] 画中画切换失败:', error);
      }
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
      error.value = null;
      lastErrorTime = 0;
      if (!u) {
        api.setUrl(u);
        return;
      }
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          unwatch();
          resolve();
        };
        const timer = setTimeout(finish, 5000);
        const unwatch = watch(
          () => [api.store.state.isReady, api.store.state.error] as const,
          ([ready, err]) => {
            if (ready || err) finish();
          },
          { immediate: true },
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
    setLoading: (loading: boolean) => {
      isLoading.value = loading;
    },
    resize: () => {
      // 原生 video 自适应容器，无需额外操作
    },
    reload: async () => {
      error.value = null;
      lastErrorTime = 0;
      const url = api.store.state.url;
      if (!url) return;
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          unwatch();
          resolve();
        };
        const timer = setTimeout(finish, 5000);
        const unwatch = watch(
          () => [api.store.state.isReady, api.store.state.error] as const,
          ([ready, err]) => {
            if (ready || err) finish();
          },
          { immediate: true },
        );
        // live 的 setUrl 会触发组件 watch 重建引擎
        api.setUrl(url);
      });
    },
    clear: async () => {
      api.pause();
      // 清空 src，释放 MSE
      const video = api.video;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    },
    retry: async () => {
      error.value = null;
      lastErrorTime = 0;
      const url = api.store.state.url;
      if (!url) return;
      api.setError?.(null);
      api.setUrl(url);
    },
  };
}
