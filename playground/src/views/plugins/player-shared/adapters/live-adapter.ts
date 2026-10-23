import type { LivePlayerApi } from '@vben/live-player';

import type { IPlayerApi, PlayerStats } from '../types';

import { ref } from 'vue';

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

  const unsub = api.store.subscribe((state) => {
    isPlaying.value = state.isPlaying ?? false;
    isLoading.value = state.isLoading ?? false;
    isReady.value = state.isReady ?? false;
    error.value = state.error ?? null;
    volume.value = state.volume ?? 1;
    isMuted.value = state.muted ?? false;
    currentTime.value = state.currentTime ?? 0;
    videoWidth.value = state.videoWidth ?? 0;
    videoHeight.value = state.videoHeight ?? 0;
    networkDelay.value = state.networkDelay ?? 0;
    stats.value = state.stats ?? {};
  });

  const getVideo = (): HTMLVideoElement | null => api.video;

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
    setUrl: (u) => api.setUrl(u),

    destroy: async () => {
      unsub.unsubscribe();
      if (recordTimer) {
        clearInterval(recordTimer);
        recordTimer = null;
      }
      api.destroy();
    },

    setScaleMode: (mode: 0 | 1 | 2) => {
      scaleMode.value = mode;
      const video = getVideo();
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
      const video = getVideo();
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
      const video = getVideo();
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
  };
}
