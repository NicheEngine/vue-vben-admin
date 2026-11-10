import type { JessibucaPlayerApi } from '@vben/jessibuca-player';
import type { IPlayerApiFull, PlayerStats } from '@vben/player-types';

import { ref, watch } from 'vue';

import { normalizeStats, safeUnsubscribe } from '@vben/player-types';

export function createJessibucaAdapter(
  api: JessibucaPlayerApi,
): IPlayerApiFull {
  const isPlaying = ref(api.store.state.isPlaying ?? false);
  const isLoading = ref(api.store.state.isLoading ?? false);
  const isReady = ref(api.store.state.isReady ?? false);
  const error = ref<null | string>(api.store.state.error ?? null);

  const volume = ref(api.store.state.volume ?? 1);
  const isMuted = ref(api.store.state.muted ?? true);
  const scaleMode = ref(api.store.state.config.scaleMode ?? 1);

  const isRecording = ref(false);
  const recordingDuration = ref(0);

  const stats = ref<PlayerStats>({ buf: 0, fps: 0, abps: 0, vbps: 0, ts: 0 });
  const networkDelay = ref(0);
  const currentTime = ref(0);
  const videoWidth = ref(0);
  const videoHeight = ref(0);

  let lastErrorTime = 0;
  const handleError = (msg: unknown) => {
    // 极严处理 unknown 类型
    let message = '未知错误';
    if (msg instanceof Error) {
      message = msg.message;
    } else if (typeof msg === 'string') {
      message = msg;
    } else if (msg !== null && msg !== undefined) {
      // 针对对象等，安全转字符串
      try {
        message = JSON.stringify(msg);
      } catch {
        message = '未知对象错误';
      }
    }

    if (!message || message === 'undefined') return;

    const now = Date.now();
    if (now - lastErrorTime > 2000) {
      error.value = message;
      lastErrorTime = now;
    }
  };

  // 劫持底层事件（单位统一为秒）
  const prev = api.getCallbacks();
  api.setCallbacks({
    ...prev,
    onPlay: () => {
      isPlaying.value = true;
      isLoading.value = false;
      isReady.value = true;
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
    onError: (err) => {
      handleError(err);
      prev?.onError?.(err);
    },
    onTimeout: (err) => {
      handleError(err);
      prev?.onTimeout?.(err);
    },
    onStats: (s) => {
      isLoading.value = false;
      // 归一化：ts 秒，buf 裁剪
      const normalized = normalizeStats({
        buf: s.buf,
        fps: s.fps,
        abps: s.abps,
        vbps: s.vbps,
        ts: (s.ts || 0) / 1000, // ms → s
      });
      stats.value = normalized;
      networkDelay.value = normalized.buf ?? 0;
      currentTime.value = normalized.ts ?? 0;
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
    onTimeUpdate: (seconds: number) => {
      currentTime.value = seconds;
      prev?.onTimeUpdate?.(seconds);
    },
    onMute: (isMute: boolean) => {
      isMuted.value = isMute;
      prev?.onMute?.(isMute);
    },
  });

  // 同步底层 store 变化
  const unsub = api.store.subscribe((state) => {
    isPlaying.value = state.isPlaying ?? false;
    isLoading.value = state.isLoading ?? false;
    isReady.value = state.isReady ?? false;
    volume.value = state.volume ?? 1;
    isMuted.value = state.muted ?? true;
    scaleMode.value = state.config.scaleMode ?? 1;
    currentTime.value = state.currentTime ?? 0;
    videoWidth.value = state.videoWidth ?? 0;
    videoHeight.value = state.videoHeight ?? 0;

    if (state.error) {
      handleError(state.error);
    } else {
      error.value = null;
    }
  });

  return {
    isPlaying,
    isLoading,
    isReady,
    error,
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
      pip: false,
      keepPlayingOffscreen: false,
    },

    play: () => api.play(),
    pause: () => api.pause(),
    toggle: () => api.toggle(),
    setVolume: (v) => api.setVolume(v),
    setMuted: (m) => {
      return m ? api.mute() : api.cancelMute();
    },
    setUrl: (u) => {
      error.value = null;
      lastErrorTime = 0;
      api.setUrl(u);
      void api.play();
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
        let unwatch: (() => void) | null = null;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          unwatch?.();
          resolve();
        };
        const timer = setTimeout(finish, 5000);
        unwatch = watch(
          () => [api.store.state.isReady, api.store.state.error] as const,
          ([ready, err]) => {
            if (ready || err) finish();
          },
          { immediate: true },
        );
        if (done) unwatch();
        api.setUrl(u);
        void api.play();
      });
    },
    destroy: async () => {
      safeUnsubscribe(unsub);
      api.setCallbacks({});
      await api.destroy();
    },

    getVideoElement: () => null, // Jessibuca 用 canvas，无 video 元素

    screenshot: (opts) =>
      api.screenshot(opts?.filename, opts?.format, 1, opts?.type ?? 'base64'),
    setScaleMode: (m) => api.setScaleMode(m),
    startRecord: (n, t) => api.startRecord(n, t),
    stopRecordAndSave: () => api.stopRecordAndSave(),

    requestFullscreen: async () => {
      const inst = api.getInstance() as any;
      if (inst && typeof inst.setFullscreen === 'function') {
        inst.setFullscreen(true);
      }
    },
    exitFullscreen: async () => {
      const inst = api.getInstance() as any;
      if (inst && typeof inst.setFullscreen === 'function') {
        inst.setFullscreen(false);
      }
    },
    setLoading: (loading: boolean) => {
      isLoading.value = loading;
    },
    resize: () => api.resize(),
    reload: async () => {
      error.value = null;
      lastErrorTime = 0;
      const url = api.store.state.url;
      if (!url) return;
      await new Promise<void>((resolve) => {
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
        api.setUrl(url);
        void api.play();
      });
    },
    clear: async () => {
      // 引擎已销毁（切换引擎的过渡期），直接忽略
      if (!api.getInstance()) {
        return;
      }
      try {
        await (api as any).clearView?.();
      } catch (error) {
        console.warn('[JessAdapter] clearView error ignored:', error);
      }
    },
    retry: async () => {
      error.value = null;
      lastErrorTime = 0;
      const url = api.store.state.url;
      if (!url) return;
      api.setUrl(url);
      void api.play();
    },
  };
}
