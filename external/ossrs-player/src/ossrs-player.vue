<script lang="ts" setup>
import type { OssrsPlayerProps } from './types';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { OssrsPlayerApi } from './ossrs-player-api';

const props = withDefaults(defineProps<OssrsPlayerProps>(), {
  autoPlay: true,
  muted: true,
  protocol: 'rtc',
});

const emit = defineEmits<{
  (e: 'error', error: Error | string): void;
  (e: 'pause' | 'play' | 'ready' | 'timeUpdate', data?: any): void;
}>();

const videoRef = ref<HTMLVideoElement>();
const ownsApi = !props.api;
const api = props.api ?? new OssrsPlayerApi();

if (typeof api.setComponentCallbacks === 'function') {
  api.setComponentCallbacks({
    onPlay: () => emit('play'),
    onPause: () => emit('pause'),
    onError: (err) => emit('error', err),
    onReady: () => emit('ready'),
    onTimeUpdate: (t) => emit('timeUpdate', t),
  });
}

let lastPlayUrl = '';

async function triggerPlay(url: string, force = false) {
  if (!url) return;
  if (!force && url === lastPlayUrl) return;
  lastPlayUrl = url;
  await nextTick();
  if (api.video) {
    api.play(url, props.protocol);
  }
}

watch(
  () => props.url,
  (newUrl, oldUrl) => {
    if (newUrl && newUrl !== oldUrl) {
      triggerPlay(newUrl);
    } else if (!newUrl) {
      lastPlayUrl = '';
      api.destroyPlayer();
    }
  },
);

watch(
  () => props.muted,
  (m) => api.setMuted(m),
);

onMounted(() => {
  if (videoRef.value) {
    videoRef.value.muted = true;
    videoRef.value.volume = 0;
    videoRef.value.setAttribute('muted', '');
    videoRef.value.setAttribute('playsinline', '');
    videoRef.value.setAttribute('autoplay', '');

    api.bindVideoElement(videoRef.value);

    if (props.url && props.autoPlay) {
      triggerPlay(props.url, true);
    }
  }
});

onBeforeUnmount(() => {
  api.bindVideoElement(null);
  if (ownsApi) api.destroy();
  else api.destroyPlayer();
});

defineExpose({ api });
</script>

<template>
  <div
    class="relative h-full w-full overflow-hidden bg-black"
    :class="props.class"
  >
    <video
      ref="videoRef"
      class="h-full w-full object-contain"
      autoplay
      playsinline
      webkit-playsinline
    ></video>

    <div
      v-if="api.store.state.isLoading"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 text-white pointer-events-none"
    >
      <div
        class="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white"
      ></div>
      <span class="text-sm">连接中...</span>
    </div>

    <div
      v-if="api.store.state.error"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 p-4 text-white"
    >
      <span class="text-sm font-medium text-red-400">{{
        api.store.state.error
      }}</span>
      <button
        v-if="props.url"
        class="mt-2 rounded bg-white/20 px-3 py-1 text-xs transition hover:bg-white/30"
        @click="triggerPlay(props.url, true)"
      >
        重试
      </button>
    </div>
  </div>
</template>
