<script lang="ts" setup>
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
  },
);

const emit = defineEmits<LivePlayerEmits>();

const videoRef = ref<HTMLVideoElement>();
let hlsPlayer: Hls | null = null;
let mpegtsPlayer: Mpegts.Player | null = null;
let sessionId = 0;

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
    if (autoplay.value && videoRef.value) {
      videoRef.value.play().catch(() => {});
    }
  });

  let hlsTimer = setInterval(() => {
    if (sid === sessionId && isApiMode && hlsPlayer) {
      const vbps = (hlsPlayer as any).bandwidthEstimate || 0;
      const buf = videoRef.value?.buffered.length
        ? (videoRef.value.buffered.end(0) - videoRef.value.currentTime) * 1000
        : 0;
      api.updateStats({
        buf,
        fps: 30,
        abps: 0,
        vbps,
        ts: videoRef.value?.currentTime || 0,
      });
      api.updateVideoSize(
        videoRef.value?.videoWidth || 0,
        videoRef.value?.videoHeight || 0,
      );
    }
  }, 1000);
  player.on(Hls.Events.DESTROYING, () => clearInterval(hlsTimer));
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
    if (autoplay.value) {
      setTimeout(() => {
        if (mpegtsPlayer) mpegtsPlayer.play();
      }, 100);
    }
  });

  player.on(Mpegts.Events.ERROR, (errorType, errorDetail) => {
    if (sid !== sessionId) return;
    console.warn('[Mpegts] Playback error:', errorType, errorDetail);
    if (
      errorType === Mpegts.ErrorTypes.NETWORK_ERROR ||
      errorType === Mpegts.ErrorTypes.MEDIA_ERROR
    ) {
      setTimeout(() => {
        if (sid === sessionId) refresh();
      }, 1000);
    }
  });

  player.on(Mpegts.Events.STATISTICS_INFO, (info: any) => {
    if (sid !== sessionId || !isApiMode) return;
    const vbps = (info.speed || 0) * 1024;
    let buf = 0;
    if (videoRef.value && videoRef.value.buffered.length > 0) {
      const curTime = videoRef.value.currentTime;
      const bufferedEnd = videoRef.value.buffered.end(
        videoRef.value.buffered.length - 1,
      );
      buf = Math.max(0, (bufferedEnd - curTime) * 1000);
    }
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
  await nextTick();
  if (videoRef.value) {
    videoRef.value.muted = muted.value;
    api.bindVideoElement(videoRef.value); // ← 绑定
  }
  if (url.value) refresh();
});

onBeforeUnmount(() => {
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
