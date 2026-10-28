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

  hlsTimer = setInterval(() => {
    if (sid === sessionId && isApiMode && hlsPlayer && videoRef.value) {
      // 1. 码率获取 (沿用你的 lastRealVbps 或 bandwidthEstimate)
      const vbps =
        lastRealVbps > 0
          ? lastRealVbps
          : (hlsPlayer as any).bandwidthEstimate || 0;

      // 2. 👈 修复 HLS 缓冲过大：直接使用 HLS 底层的真实 latency
      let buf = 0;

      // hls.js 内部有一个 latency 属性，代表了距离直播边缘的真实秒数
      const hlsLatency = (hlsPlayer as any).latency;

      if (hlsLatency !== undefined && hlsLatency !== null) {
        // hlsLatency 单位是秒，转为毫秒
        buf = hlsLatency * 1000;
      } else {
        // 兜底方案：使用 seekable 计算，但加上更严苛的截断
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

      // 👈 如果是普通直播，HLS 延迟通常在 3~6 秒。这里限制上限为 8000ms。
      // 如果超过 8000ms，说明推流端网络堆积严重，强制显示 8000ms 防止 UI 爆炸。
      if (buf > 8000) buf = 8000;
      if (buf < 0) buf = 0;

      // 3. 增加抖动 (沿用刚才的 10% 抖动)
      const jitterFactor = 0.9 + Math.random() * 0.2;

      api.updateStats({
        buf: buf * jitterFactor,
        fps: 30,
        abps: 0,
        vbps: vbps * jitterFactor,
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

  player.on(Mpegts.Events.STATISTICS_INFO, (info: any) => {
    if (sid !== sessionId || !isApiMode) return;

    // 1. 计算基础值
    const rawVbps = (info.speed || 0) * 1024 * 8;

    let rawBuf = 0;
    if (videoRef.value && videoRef.value.buffered.length > 0) {
      const curTime = videoRef.value.currentTime;
      const bufferedEnd = videoRef.value.buffered.end(
        videoRef.value.buffered.length - 1,
      );
      rawBuf = Math.max(0, (bufferedEnd - curTime) * 1000);
      if (rawBuf > 5000) rawBuf = 5000;
    }

    // 2. 👈 核心新增：生成 0.9 ~ 1.1 的抖动系数
    // 这样数据会在 90% 到 110% 之间波动，视觉上就有明显的跳动感
    const jitterFactor = 0.9 + Math.random() * 0.2;

    const vbps = rawVbps * jitterFactor;
    // 延迟也加上一点点微小抖动，让它也动起来
    const buf = rawBuf * jitterFactor;

    // 3. 更新给 UI
    api.updateStats({
      buf,
      fps: info.decodedFrames || 30,
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
  if (isApiMode && api.store.state.url !== url.value) return;
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
