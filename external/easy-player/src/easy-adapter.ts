import type { EasyPlayerApi } from '@vben/easy-player';
import type { IPlayerApi, PlayerStats } from '@vben/player-types';

import { ref, watch } from 'vue';

import { normalizeStats, safeUnsubscribe } from '@vben/player-types';

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

  const getVideo = (): HTMLVideoElement | null => {
    const inst = api.getInstance() as any;
    return inst?.video || inst?.$el?.querySelector('video') || null;
  };

  // ================= 2. 网络质量估算 =================
  let hlsTimerId: null | ReturnType<typeof setInterval> = null;
  let lastDecodedFrames = 0;
  let lastStatsTime = 0;
  let smoothedBuf = 0;

  // 用于 1 秒更新码率的数据缓冲
  let vbpsBuffer: number[] = [];
  let latestFps = 0;

  const startStats = () => {
    if (hlsTimerId) return;

    lastDecodedFrames = 0;
    lastStatsTime = performance.now();
    smoothedBuf = 0;
    vbpsBuffer = [];

    // 每 200ms 采集一次数据，这样算出来的平滑值最准确
    hlsTimerId = setInterval(() => {
      const video = getVideo();
      const inst = api.getInstance() as any;
      if (!video || video.paused) return;

      const now = performance.now();
      const dt = (now - lastStatsTime) / 1000;
      if (dt <= 0) return;

      // ==========================================
      // 1. 获取视频码率 (完全对齐源码逻辑)
      // ==========================================
      let instantVbps = 0;

      try {
        // 【路径 A】：如果是 FLV 流，直接读源码里的 flv.js 采样器！
        const flvSpeedSampler =
          inst?.easyPlayer?.tech_?.flvPlayer?._transmuxer?._controller?._ioctl
            ?._speedSampler;
        if (
          flvSpeedSampler &&
          typeof flvSpeedSampler.averageKBps === 'number'
        ) {
          // 源码：averageKBps 是 KB/s，乘 8 得到 Kbps(即 bps 的千分之一)，再乘 1000 得到标准 bps
          instantVbps = flvSpeedSampler.averageKBps * 8 * 1000;
        }
        // 【路径 B】：如果是 HLS 流，hls.js 内部有带宽估算
        else {
          const hlsPlayer = inst?.easyPlayer?.tech_?.hlsPlayer;
          if (hlsPlayer && typeof hlsPlayer.bandwidthEstimate === 'number') {
            instantVbps = hlsPlayer.bandwidthEstimate;
          }
        }
      } catch {
        // ✅ 规范修复：忽略属性读取异常，省略错误变量
      }

      // 如果底层拿不到，用分辨率兜底
      if (instantVbps === 0 && video.videoWidth > 0) {
        const pixels = video.videoWidth * video.videoHeight;
        // ✅ 规范修复：提取为独立函数或使用查表，避免 if-else 或嵌套三元
        const getFallbackVbps = (p: number) => {
          if (p >= 1920 * 1080) return 2_500_000;
          if (p >= 1280 * 720) return 1_200_000;
          return 500_000;
        };

        instantVbps = getFallbackVbps(pixels);
      }

      // 把采集到的数据推入数组
      vbpsBuffer.push(instantVbps);

      // ==========================================
      // 2. 计算帧率 (fps)
      // ==========================================
      const quality = (video as any).getVideoPlaybackQuality?.();
      if (quality) {
        if (lastDecodedFrames > 0) {
          const df = quality.totalVideoFrames - lastDecodedFrames;
          if (df >= 0) latestFps = Math.round(df / dt);
        }
        lastDecodedFrames = quality.totalVideoFrames;
      }

      // ==========================================
      // 3. 计算缓冲 (buf) 并平滑
      // ==========================================
      let buf = 0;
      if (video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (
            video.buffered.start(i) <= video.currentTime &&
            video.currentTime <= video.buffered.end(i)
          ) {
            buf = (video.buffered.end(i) - video.currentTime) * 1000;
            break;
          }
        }
      }
      if (buf > 8000) buf = 8000;
      if (buf < 0) buf = 0;

      // 平滑缓冲曲线，防止锯齿
      smoothedBuf = smoothedBuf === 0 ? buf : smoothedBuf * 0.6 + buf * 0.4;

      lastStatsTime = now;

      // ==========================================
      // 4. 累积满 1 秒后，进行一次 UI 更新
      // ==========================================
      // 200ms * 5 = 1000ms，每 5 个采样点执行一次写入
      if (vbpsBuffer.length >= 5) {
        // 对这 5 个点的码率求平均值，消除瞬间毛刺
        const avgVbps =
          vbpsBuffer.reduce((a, b) => a + b, 0) / vbpsBuffer.length;

        const normalized = normalizeStats({
          buf: Math.round(smoothedBuf),
          fps: latestFps,
          abps: 0,
          vbps: Math.round(avgVbps),
          ts: video.currentTime || 0,
        });

        networkDelay.value = normalized.buf ?? 0;
        stats.value = normalized;

        // 清空数组，开始下一轮的 1 秒采集
        vbpsBuffer = [];
      }
    }, 200);
  };

  const stopStats = () => {
    if (hlsTimerId) {
      clearInterval(hlsTimerId);
      hlsTimerId = null;
    }
    lastDecodedFrames = 0;
    smoothedBuf = 0;
    vbpsBuffer = [];
    latestFps = 0;
    networkDelay.value = 0;
    stats.value = { buf: 0, fps: 0, abps: 0, vbps: 0, ts: 0 };
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
    setUrlAsync: async (u) => {
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 5000); // 5秒超时兜底
        // 监听 store 中的 isReady
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
      cleanupRecord();
      stopStats();
      safeUnsubscribe(unsub);
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

    getVideoElement: () => getVideo(),

    requestFullscreen: async () => {
      // 标准化：找到播放器最外层包裹容器
      const el =
        (getVideo()?.closest('.easy-player-wrapper') as HTMLElement) ||
        getVideo()?.parentElement;
      if (el && !document.fullscreenElement) {
        await el.requestFullscreen();
      }
    },
    exitFullscreen: async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    },
  };
}
