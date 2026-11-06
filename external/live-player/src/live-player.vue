<script lang="ts" setup>
import type { CSSProperties } from 'vue';

import type {
  LivePlayerEmits,
  LivePlayerProps,
  LivePlayerStoreState,
} from './types';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import Hls from 'hls.js';
import Mpegts from 'mpegts.js';

import { LivePlayerApi } from './live-player-api';
import { LiveType } from './types';

const props = withDefaults(
  defineProps<LivePlayerProps & { livePlayerApi?: LivePlayerApi }>(),
  {
    autoplay: true,
    controls: true,
    muted: true,
    hlsOptions: undefined,
    mpegtsOptions: undefined,
    type: undefined,
    livePlayerApi: undefined,
    objectFit: 'contain',
  },
);

const emit = defineEmits<LivePlayerEmits>();

const videoRef = ref<HTMLVideoElement>();
let hlsPlayer: Hls | null = null;
let mpegtsPlayer: Mpegts.Player | null = null;
let sessionId = 0;
let hlsTimer: null | ReturnType<typeof setInterval> = null;
let mpegtsRetryCount = 0;
let mounted = false;

const ownsApi = !props.livePlayerApi;
const api = props.livePlayerApi ?? new LivePlayerApi();

if (typeof api.setComponentCallbacks === 'function') {
  api.setComponentCallbacks({
    onPlay: () => emit('play'),
    onPause: () => emit('pause'),
    onError: (err) => emit('error', err),
    onLoadStart: () => emit('loadStart'),
    onLoadEnd: () => emit('loadEnd'),
    onReady: () => emit('ready'),
    onTimeUpdate: (t) => emit('timeUpdate', t),
    onVolumeChange: (v) => emit('volumeChange', v),
  });
}

const isApiMode = !!props.livePlayerApi;

const localState = reactive<Pick<LivePlayerStoreState, 'error' | 'isLoading'>>({
  isLoading: false,
  error: null,
});

const maxRetry = computed(
  () => props.mpegtsMaxRetry ?? api.store.state.mpegtsMaxRetry ?? 3,
);

const videoStyle = computed<CSSProperties>(() => ({
  objectFit: props.objectFit || 'contain',
}));

const state = computed<Pick<LivePlayerStoreState, 'error' | 'isLoading'>>(() =>
  isApiMode
    ? { error: api.store.state.error, isLoading: api.store.state.isLoading }
    : localState,
);

const url = computed(() => props.url ?? api.store.state.url ?? '');
const autoplay = computed(
  () => props.autoplay ?? api.store.state.autoplay ?? true,
);
const muted = computed(() => props.muted ?? api.store.state.muted ?? true);
const controls = computed(
  () => props.controls ?? api.store.state.controls ?? true,
);
const type = computed(() => props.type ?? api.store.state.type);
const hlsOptions = computed(
  () => props.hlsOptions ?? api.store.state.hlsOptions,
);
const mpegtsOptions = computed(
  () => props.mpegtsOptions ?? api.store.state.mpegtsOptions,
);

function setLoading(loading: boolean) {
  if (isApiMode) api.setLoading(loading);
  else localState.isLoading = loading;
}

function setError(error: null | string) {
  if (isApiMode) api.setError(error);
  else localState.error = error;
}

function destroyLivePlayer() {
  if (hlsTimer) {
    clearInterval(hlsTimer); // 强制清理定时器
    hlsTimer = null;
  }
  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }
  if (mpegtsPlayer) {
    mpegtsPlayer.destroy();
    mpegtsPlayer = null;
  }
}

function loadHls(resource: string, sid: number) {
  if (!Hls.isSupported()) {
    if (videoRef.value?.canPlayType('application/vnd.apple.mpegURL')) {
      videoRef.value.src = resource;
      return;
    }
    setError(`HLS not supported`);
    return;
  }
  const player = new Hls(hlsOptions.value);
  hlsPlayer = player;
  player.loadSource(resource);
  if (videoRef.value) player.attachMedia(videoRef.value);

  player.on(Hls.Events.MANIFEST_PARSED, () => {
    if (sid !== sessionId) return;
    setLoading(false);
    if (isApiMode) api.updateReady(true);
    if (autoplay.value && videoRef.value) {
      videoRef.value.play().catch(() => {});
    }
  });

  // 👈 核心修复：在分片加载时，计算真实的码率并缓存下来
  let lastRealVbps = 0;
  player.on(Hls.Events.FRAG_LOADED, (_event, data) => {
    if (sid !== sessionId) return;
    // data.frag.duration 是视频片段的真实秒数（比如 2s, 4s）
    // data.payload.byteLength 是片段的字节数
    if (data.frag.duration > 0) {
      lastRealVbps = (data.payload.byteLength * 8) / data.frag.duration;
    }
  });

  let lastDecodedFrames = 0;
  let lastStatsTime = 0;
  hlsTimer = setInterval(() => {
    if (sid === sessionId && isApiMode && hlsPlayer && videoRef.value) {
      // 1. 码率：优先用 FRAG_LOADED 缓存值
      const vbps =
        lastRealVbps > 0
          ? lastRealVbps
          : (hlsPlayer as any).bandwidthEstimate || 0;

      // 2. 缓冲：hls.js 底层 latency（直播边缘真实距离）
      let buf = 0;
      const hlsLatency = (hlsPlayer as any).latency;
      if (hlsLatency !== undefined && hlsLatency !== null) {
        buf = hlsLatency * 1000;
      } else {
        try {
          if (videoRef.value.seekable && videoRef.value.seekable.length > 0) {
            const seekableEnd = videoRef.value.seekable.end(
              videoRef.value.seekable.length - 1,
            );
            if (seekableEnd > videoRef.value.currentTime) {
              buf = (seekableEnd - videoRef.value.currentTime) * 1000;
            }
          }
        } catch {}
      }
      if (buf > 8000) buf = 8000;
      if (buf < 0) buf = 0;

      // 3. 帧率：用 getVideoPlaybackQuality 累计帧数差值
      let fps = 0;
      const now = performance.now();
      const quality = (videoRef.value as any).getVideoPlaybackQuality?.();
      if (quality && lastStatsTime > 0) {
        const dt = (now - lastStatsTime) / 1000;
        if (dt > 0 && lastDecodedFrames > 0) {
          const df = quality.totalVideoFrames - lastDecodedFrames;
          if (df >= 0) fps = Math.round(df / dt);
        }
        lastDecodedFrames = quality.totalVideoFrames;
      } else if (quality) {
        lastDecodedFrames = quality.totalVideoFrames;
      }
      lastStatsTime = now;

      api.updateStats({
        buf,
        fps,
        abps: 0,
        vbps,
        ts: videoRef.value.currentTime || 0,
      });
      api.updateVideoSize(
        videoRef.value.videoWidth || 0,
        videoRef.value.videoHeight || 0,
      );
    }
  }, 1000);
}

function loadMpegts(resource: string, sid: number) {
  if (!Mpegts.getFeatureList().mseLivePlayback) {
    setError(`MPEGTS not supported`);
    return;
  }

  const opts = mpegtsOptions.value || {};

  const mergedConfig = {
    enableStashBuffer: false,
    autoCleanupSourceBuffer: true,
    liveSync: false,
    lazyLoad: false,
    deferLoadAfterSourceOpen: false,
    fixAudioTimestampGap: false,
    ...opts.config,
  };

  const player = Mpegts.createPlayer(
    {
      type: 'flv',
      isLive: true,
      ...opts.datasource,
      url: resource,
    } as Mpegts.MediaDataSource,
    mergedConfig,
  );

  mpegtsPlayer = player;

  player.on(Mpegts.Events.MEDIA_INFO, () => {
    if (sid !== sessionId) return;
    setLoading(false);
    if (isApiMode) api.updateReady(true);
    if (autoplay.value) {
      setTimeout(() => {
        if (mpegtsPlayer) mpegtsPlayer.play();
      }, 100);
    }
  });

  player.on(Mpegts.Events.ERROR, (errorType, errorDetail) => {
    if (sid !== sessionId) return;
    console.warn('[Mpegts] Playback error:', errorType, errorDetail);
    setLoading(false);
    if (isApiMode) api.updateReady(false);
    if (
      errorType === Mpegts.ErrorTypes.NETWORK_ERROR ||
      errorType === Mpegts.ErrorTypes.MEDIA_ERROR
    ) {
      mpegtsRetryCount++;

      const max = maxRetry.value;
      // 核心判断：-1 无限重试；0 不重试；>0 在限制内重试
      const shouldRetry = max === -1 || (max > 0 && mpegtsRetryCount <= max);
      if (shouldRetry) {
        setTimeout(() => {
          if (sid === sessionId) refresh();
        }, 1000);
      } else {
        setError(`网络连接失败，已重试 ${mpegtsRetryCount - 1} 次后停止`);
      }
    }
  });

  let lastDecodedFrames = 0;
  let lastStatsTime = 0;
  player.on(Mpegts.Events.STATISTICS_INFO, (info: any) => {
    if (sid !== sessionId || !isApiMode) return;

    // 1. 码率
    const vbps = (info.speed || 0) * 1024 * 8;

    // 2. 缓冲
    let buf = 0;
    if (videoRef.value && videoRef.value.buffered.length > 0) {
      const curTime = videoRef.value.currentTime;
      const bufferedEnd = videoRef.value.buffered.end(
        videoRef.value.buffered.length - 1,
      );
      buf = Math.max(0, (bufferedEnd - curTime) * 1000);
      if (buf > 8000) buf = 8000;
    }

    // 3. 帧率：decodedFrames 是累计值，用差值
    let fps = 0;
    const now = performance.now();
    if (lastStatsTime > 0 && lastDecodedFrames > 0) {
      const dt = (now - lastStatsTime) / 1000;
      const df = (info.decodedFrames || 0) - lastDecodedFrames;
      if (dt > 0 && df >= 0) fps = Math.round(df / dt);
    }
    lastDecodedFrames = info.decodedFrames || 0;
    lastStatsTime = now;

    api.updateStats({
      buf,
      fps,
      abps: 0,
      vbps,
      ts: videoRef.value?.currentTime || 0,
    });
    api.updateVideoSize(
      videoRef.value?.videoWidth || 0,
      videoRef.value?.videoHeight || 0,
    );
  });

  if (videoRef.value) player.attachMediaElement(videoRef.value);
  player.load();
}

function refresh() {
  if (!videoRef.value) return;
  const targetUrl = url.value;
  if (!targetUrl) {
    destroyLivePlayer();
    if (isApiMode) {
      setLoading(false);
      api.updatePlaying(false);
      api.updateReady(false);
      videoRef.value.pause();
      videoRef.value.removeAttribute('src');
      videoRef.value.load();
    }
    return;
  }

  sessionId++;
  const sid = sessionId;

  destroyLivePlayer();
  mpegtsRetryCount = 0;

  if (!mounted) return;

  setLoading(true);
  setError(null);
  if (isApiMode) api.updateReady(false);

  const lowerUrl = targetUrl.toLowerCase();
  let useHls: boolean;

  if (lowerUrl.includes('.m3u8')) {
    useHls = true;
  } else if (lowerUrl.includes('.flv')) {
    useHls = false;
  } else {
    useHls = type.value === LiveType.HLS;
  }

  if (useHls) loadHls(targetUrl, sid);
  else loadMpegts(targetUrl, sid);
}

let lastPauseTime = 0;

function onPlay() {
  if (Date.now() - lastPauseTime < 300) return;
  if (isApiMode) api.updatePlaying(true);
}

function onPause() {
  lastPauseTime = Date.now();
  if (isApiMode) api.updatePlaying(false);
}

function onTimeUpdate() {
  if (isApiMode && videoRef.value) {
    api.updateCurrentTime(videoRef.value.currentTime);
  }
}
function onVolumeChange() {
  if (isApiMode && videoRef.value) api.setVolume(videoRef.value.volume);
}
function onCanPlay() {
  setLoading(false);
  if (isApiMode) api.updateReady(true);
}

watch(url, (n, o) => {
  if (n !== o) refresh();
});
watch(type, () => {
  if (url.value) refresh();
});

if (isApiMode) {
  watch(
    () => api.store.state.volume,
    (vol) => {
      if (videoRef.value) videoRef.value.volume = vol ?? 1;
    },
  );
  watch(
    () => api.store.state.muted,
    (m) => {
      if (videoRef.value) videoRef.value.muted = m ?? false;
    },
  );
}

onMounted(async () => {
  mounted = true;
  await nextTick();
  if (videoRef.value) {
    videoRef.value.muted = muted.value;
    api.bindVideoElement(videoRef.value); // ← 绑定
  }
  if (url.value) refresh();
});

onBeforeUnmount(() => {
  mounted = false;
  sessionId++;
  destroyLivePlayer();
  api.bindVideoElement(null); // ← 解绑
  if (ownsApi) api.destroy();
});

defineExpose({ api });
</script>

<template>
  <div class="relative h-full w-full bg-black" :class="[props.class]">
    <video
      ref="videoRef"
      :autoplay="autoplay"
      :controls="controls"
      :muted="muted"
      :style="videoStyle"
      class="h-full w-full"
      @canplay="onCanPlay"
      @pause="onPause"
      @play="onPlay"
      @timeupdate="onTimeUpdate"
      @volumechange="onVolumeChange"
    ></video>
    <div
      v-if="state.isLoading"
      class="absolute inset-0 flex items-center justify-center bg-black/50"
    >
      <slot name="loading">加载中...</slot>
    </div>
    <div
      v-if="state.error"
      class="absolute inset-0 flex items-center justify-center bg-black/75 px-4 text-center text-white"
    >
      <slot name="error">{{ state.error }}</slot>
    </div>
  </div>
</template>
