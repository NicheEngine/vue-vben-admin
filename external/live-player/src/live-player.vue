<script lang="ts" setup>
import type {
  ExtendedLivePlayerApi,
  LivePlayerProps,
  LivePlayerStoreState,
} from './types';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import Hls from 'hls.js';
import Mpegts from 'mpegts.js';

import { LiveType } from './types';

const props = withDefaults(
  defineProps<LivePlayerProps & { livePlayerApi?: ExtendedLivePlayerApi }>(),
  {
    autoplay: true,
    controls: true,
    muted: false,
    livePlayerApi: undefined,
  },
);

const videoRef = ref<HTMLVideoElement>();
let hlsPlayer: Hls | null = null;
let mpegtsPlayer: Mpegts.Player | null = null;

const api = props.livePlayerApi;
const isApiMode = !!api;

// 非 API 模式用本地 reactive 状态，保证模板能响应
const localState = reactive<{
  isLoading: boolean;
  error: null | string;
}>({
  isLoading: false,
  error: null,
});

const stateRef = api?.useSelector?.() ?? api?.useStore?.();
const state = computed<Partial<LivePlayerStoreState>>(() =>
  isApiMode && stateRef ? stateRef.value : localState,
);

const url = computed(() => props.url ?? state.value.url ?? '');
const autoplay = computed(() => props.autoplay ?? state.value.autoplay ?? true);
const muted = computed(() => props.muted ?? state.value.muted ?? false);
const controls = computed(() => props.controls ?? state.value.controls ?? true);
const type = computed(() => props.type ?? state.value.type);
const hlsOptions = computed(() => props.hlsOptions ?? state.value.hlsOptions);
const mpegtsOptions = computed(
  () => props.mpegtsOptions ?? state.value.mpegtsOptions,
);

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

function setLoading(loading: boolean) {
  if (isApiMode && api) api.setLoading(loading);
  else localState.isLoading = loading;
}

function setError(error: null | string) {
  if (isApiMode && api) api.setError(error);
  else localState.error = error;
}

function setReady(ready: boolean) {
  if (isApiMode && api) api.updateReady(ready);
}

function loadHls(resource: string) {
  if (!Hls.isSupported()) {
    if (videoRef.value?.canPlayType('application/vnd.apple.mpegURL')) {
      videoRef.value.src = resource;
      return;
    }
    const message = `HLS not supported for ${resource}`;
    console.error(message);
    setError(message);
    return;
  }
  const livePlayer = new Hls(hlsOptions.value);
  hlsPlayer = livePlayer;
  livePlayer.loadSource(resource);
  if (videoRef.value) livePlayer.attachMedia(videoRef.value);
  livePlayer.on(Hls.Events.MANIFEST_PARSED, () => {
    setReady(true);
    if (autoplay.value && videoRef.value) videoRef.value.play();
  });
  livePlayer.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.MEDIA_ERROR: {
          livePlayer.recoverMediaError();
          break;
        }
        case Hls.ErrorTypes.NETWORK_ERROR: {
          livePlayer.startLoad();
          break;
        }
        default: {
          livePlayer.destroy();
          hlsPlayer = null;
          setError(data.details);
          break;
        }
      }
    }
  });
}

function loadMpegts(resource: string) {
  if (!Mpegts.getFeatureList().mseLivePlayback) {
    const message = `MPEGTS not supported for ${resource}`;
    console.error(message);
    setError(message);
    return;
  }
  const opts = mpegtsOptions.value;
  const livePlayer = Mpegts.createPlayer(
    {
      ...opts?.datasource,
      url: resource,
    } as Mpegts.MediaDataSource,
    opts?.config,
  );
  mpegtsPlayer = livePlayer;
  livePlayer.on(Mpegts.Events.MEDIA_INFO, () => {
    setReady(true);
    if (autoplay.value) livePlayer.play();
  });
  livePlayer.on(Mpegts.Events.ERROR, (_event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Mpegts.ErrorTypes.MEDIA_ERROR: {
          livePlayer.unload();
          break;
        }
        case Mpegts.ErrorTypes.NETWORK_ERROR: {
          livePlayer.load();
          break;
        }
        default: {
          livePlayer.destroy();
          mpegtsPlayer = null;
          setError(data.details);
          break;
        }
      }
    }
  });
  if (videoRef.value) livePlayer.attachMediaElement(videoRef.value);
  livePlayer.load();
}

function refresh() {
  if (!videoRef.value) return;
  const targetUrl = url.value;
  if (!targetUrl) {
    console.warn('[LivePlayer] URL is empty');
    return;
  }
  destroyLivePlayer();
  setLoading(true);
  setError(null);

  let useHls: boolean;
  if (type.value === LiveType.HLS) useHls = true;
  else if (type.value === LiveType.MPEGTS) useHls = false;
  else useHls = targetUrl.includes('.m3u8');

  if (useHls) loadHls(targetUrl);
  else loadMpegts(targetUrl);
}

function onPlay() {
  if (isApiMode && api) api.updatePlaying(true);
}
function onPause() {
  if (isApiMode && api) api.updatePlaying(false);
}
function onTimeUpdate() {
  if (isApiMode && api && videoRef.value) {
    api.updateCurrentTime(videoRef.value.currentTime);
  }
}
function onVolumeChange() {
  if (isApiMode && api && videoRef.value) {
    api.setVolume(videoRef.value.volume);
  }
}
function onCanPlay() {
  setLoading(false);
}
function onError() {
  if (videoRef.value?.error) setError(videoRef.value.error.message);
}

watch(url, (newUrl, oldUrl) => {
  if (newUrl && newUrl !== oldUrl) refresh();
});
watch(type, () => {
  if (url.value) refresh();
});

if (isApiMode && api) {
  watch(
    () => api.store.state.isPlaying,
    (playing) => {
      if (videoRef.value) {
        if (playing) videoRef.value.play();
        else videoRef.value.pause();
      }
    },
  );
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
  watch(
    () => api.store.state.currentTime,
    (time) => {
      if (
        videoRef.value &&
        Math.abs(videoRef.value.currentTime - (time ?? 0)) > 0.1
      ) {
        videoRef.value.currentTime = time ?? 0;
      }
    },
  );
}

onMounted(() => {
  if (url.value) refresh();
});

onBeforeUnmount(() => {
  destroyLivePlayer();
  // 注意：destroy API 由创建者负责，组件不主动 destroy
});
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
      @error="onError"
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
      class="absolute inset-0 flex items-center justify-center bg-black/75 text-white"
    >
      <slot name="error">{{ state.error }}</slot>
    </div>
  </div>
</template>
