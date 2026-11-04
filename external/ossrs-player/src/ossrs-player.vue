<script lang="ts" setup>
import type { OssrsPlayerProps } from './types';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { OssrsPlayerApi } from './ossrs-player-api';

const props = withDefaults(defineProps<OssrsPlayerProps>(), {
  autoplay: true,
  muted: true,
  protocol: 'rtc',
  objectFit: 'contain',
});

const emit = defineEmits<{
  (e: 'error', error: Error | string): void;
  (e: 'pause' | 'play' | 'ready' | 'timeUpdate', data?: any): void;
}>();

const videoStyle = computed(() => ({
  objectFit: props.objectFit,
}));

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

watch(
  () => props.muted,
  (m) => api.setMuted(m),
);

onMounted(() => {
  if (videoRef.value) {
    // 初始化视频元素属性
    videoRef.value.muted = api.store.state.muted;
    videoRef.value.volume = api.store.state.volume;
    videoRef.value.setAttribute(
      'muted',
      api.store.state.muted ? 'true' : 'false',
    );
    videoRef.value.setAttribute('playsinline', '');

    api.store.setState((prev) => ({ ...prev, autoplay: props.autoplay }));

    // 绑定底层 API
    api.bindVideoElement(videoRef.value);

    // 如果父组件传入了 URL，立即触发
    if (props.url && props.autoplay) {
      api.play(props.url, props.protocol);
    }
  }
});

onBeforeUnmount(() => {
  api.bindVideoElement(null);
  if (ownsApi) api.destroy();
  else api.destroyPlayer();
});

// 手动重试
function handleRetry() {
  if (props.url) {
    api.play(props.url, props.protocol);
  }
}

defineExpose({ api });
</script>

<template>
  <div
    class="relative h-full w-full overflow-hidden bg-black"
    :class="props.class"
  >
    <video
      ref="videoRef"
      class="absolute inset-0 h-full w-full"
      :style="videoStyle"
      playsinline
      webkit-playsinline
    ></video>

    <!-- 👈 使用 Tailwind 的过渡类代替 scoped style -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="api.store.state.isLoading"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 text-white pointer-events-none"
      >
        <div
          class="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white"
        ></div>
        <span class="text-sm">连接中...</span>
      </div>
    </Transition>

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
        @click="handleRetry"
      >
        重试
      </button>
    </div>
  </div>
</template>
