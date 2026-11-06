import type { OssrsPlayerApi } from '@vben/ossrs-player';
import type { IPlayerApi, PlayerStats } from '@vben/player-types';

import { ref } from 'vue';

import { normalizeStats, safeUnsubscribe } from '@vben/player-types';

export function createOssrsAdapter(api: OssrsPlayerApi): IPlayerApi {
  const isPlaying = ref(api.store.state.isPlaying ?? false);
  const isLoading = ref(api.store.state.isLoading ?? false);
  const isReady = ref(api.store.state.isReady ?? false);
  const error = ref<null | string>(api.store.state.error ?? null);
  const isMuted = ref(api.store.state.muted ?? true);
  const volume = ref(api.store.state.volume ?? 1);
  const currentTime = ref(api.store.state.currentTime ?? 0);
  const videoWidth = ref(api.store.state.videoWidth ?? 0);
  const videoHeight = ref(api.store.state.videoHeight ?? 0);

  const networkDelay = ref(0);
  const stats = ref<PlayerStats>({ buf: 0, fps: 0, abps: 0, vbps: 0, ts: 0 });
  const scaleMode = ref<0 | 1 | 2>(1);

  const isRecording = ref(false);
  const recordingDuration = ref(0);
  let mediaRecorder: MediaRecorder | null = null;
  let recordTimer: null | ReturnType<typeof setInterval> = null;
  let drawTimer: null | ReturnType<typeof setInterval> = null;

  let lastUrl = '';
  let statsInterval: null | ReturnType<typeof setInterval> = null;
  let lastBytesReceived = 0;
  let lastStatsTime = 0;
  let lastDecodedFrames = 0;

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

    if (state.isPlaying) startStats();
    else {
      stopStats();
      networkDelay.value = 0;
      stats.value = { buf: 0, fps: 0, abps: 0, vbps: 0, ts: 0 };
    }
  });

  const startStats = () => {
    if (statsInterval) return;
    lastBytesReceived = 0;
    lastStatsTime = 0;
    lastDecodedFrames = 0;

    statsInterval = setInterval(async () => {
      if (!isPlaying.value) return;

      let finalDelay = 0;
      let vbps = 0;
      let fps = 0;

      try {
        const report = await api.getStats();
        if (report) {
          let rtt = -1;
          let jitter = -1;
          let jitterBufferDelay = -1;
          let currentBytesReceived = 0;
          let currentDecodedFrames = 0;

          report.forEach((r: any) => {
            if (
              r.type === 'candidate-pair' &&
              r.state === 'succeeded' &&
              r.currentRoundTripTime
            ) {
              rtt = r.currentRoundTripTime;
            }
            if (r.type === 'inbound-rtp' && r.kind === 'video') {
              if (r.jitter) jitter = r.jitter;
              if (r.bytesReceived) currentBytesReceived = r.bytesReceived;
              if (r.framesDecoded) currentDecodedFrames = r.framesDecoded;
              if (r.jitterBufferDelay && r.jitterBufferEmittedCount) {
                jitterBufferDelay =
                  r.jitterBufferDelay / r.jitterBufferEmittedCount;
              }
            }
          });

          const now = performance.now();

          // 码率：首帧只记基线，后续算差值
          if (lastStatsTime > 0 && lastBytesReceived > 0) {
            const dt = (now - lastStatsTime) / 1000;
            if (dt > 0 && currentBytesReceived >= lastBytesReceived) {
              vbps = ((currentBytesReceived - lastBytesReceived) * 8) / dt;
            }
          }
          // 帧率：同样首帧记基线
          if (lastStatsTime > 0 && lastDecodedFrames > 0) {
            const dt = (now - lastStatsTime) / 1000;
            if (dt > 0 && currentDecodedFrames >= lastDecodedFrames) {
              fps = Math.round((currentDecodedFrames - lastDecodedFrames) / dt);
            }
          }

          // 更新基线（首帧或重连时重置）
          if (currentBytesReceived > 0)
            lastBytesReceived = currentBytesReceived;
          if (currentDecodedFrames > 0)
            lastDecodedFrames = currentDecodedFrames;
          lastStatsTime = now;

          // 延迟：优先 jitterBufferDelay，次选 jitter，最后 rtt
          if (jitterBufferDelay > 0) finalDelay = jitterBufferDelay * 1000;
          else if (jitter > 0) finalDelay = jitter * 1000;
          else if (rtt > 0) finalDelay = rtt * 1000;
        }
      } catch {
        /* ignore */
      }

      const normalized = normalizeStats({
        buf: finalDelay,
        fps,
        abps: 0,
        vbps,
        ts: currentTime.value || 0,
      });

      networkDelay.value = normalized.buf ?? 0;
      stats.value = normalized;
    }, 1000);
  };

  const stopStats = () => {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
    lastBytesReceived = 0;
    lastStatsTime = 0;
    lastDecodedFrames = 0;
  };

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
      screenshot: true,
      record: true,
      scaleMode: true,
      stats: true,
      seek: false,
      fullscreen: true,
    },

    play: async () => {
      if (!lastUrl) {
        api.toggle();
        return;
      }
      await api.play(lastUrl);
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
      error.value = null;
      lastUrl = u;
      if (u) {
        void api.play(u);
      } else {
        api.destroyPlayer();
        stopStats();
      }
    },
    setUrlAsync: async (u) => {
      lastUrl = u;
      if (!u) {
        api.destroyPlayer();
        stopStats();
        return;
      }
      await api.play(u);
    },
    screenshot: (opts) => {
      const video = api.video;
      if (!video || !video.videoWidth) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas
        .getContext('2d')
        ?.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL(`image/${opts?.format || 'png'}`);
    },

    startRecord: () => {
      const video = api.video;
      if (!video) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      drawTimer = setInterval(() => {
        if (!video.paused && !video.ended) {
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }, 40);

      const stream = canvas.captureStream(25);
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (drawTimer) {
          clearInterval(drawTimer);
          drawTimer = null;
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

    destroy: async () => {
      stopStats();
      safeUnsubscribe(unsub);

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (recordTimer) clearInterval(recordTimer);

      if (drawTimer) {
        clearInterval(drawTimer);
        drawTimer = null;
      }

      if (api.video?.srcObject) {
        const stream = api.video.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        api.video.srcObject = null;
      }
      api.destroy();
      lastUrl = '';
    },

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
