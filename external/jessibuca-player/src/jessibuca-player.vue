<script setup lang="ts">
import type { JessibucaInstance, JessibucaPlayerProps } from './types';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { JessibucaPlayerApi } from './jessibuca-player-api';

const props = withDefaults(defineProps<JessibucaPlayerProps>(), {
  config: () => ({}),
  controls: true,
});

const emit = defineEmits<{
  play: [];
  pause: [];
  error: [error: Error | string];
  load: [];
  videoInfo: [info: any];
  stats: [stats: any];
  timeout: [error: string];
  fullscreen: [isFullscreen: boolean];
  mute: [isMuted: boolean];
  recordStart: [];
  recordEnd: [blob: Blob];
  recording: [duration: number];
}>();

const containerRef = ref<HTMLDivElement>();

const ownsApi = !props.api;

const api =
  props.api ??
  new JessibucaPlayerApi({
    config: props.config,
    url: props.url,
  });

/**
 * 防御性挂载回调，防止外部传入的 api 没有 setComponentCallbacks 方法（如 Proxy 对象）
 */
if (typeof api.setComponentCallbacks === 'function') {
  api.setComponentCallbacks({
    onPlay: () => emit('play'),
    onPause: () => emit('pause'),
    onError: (err) => emit('error', err),
    onLoad: () => emit('load'),
    onVideoInfo: (info) => emit('videoInfo', info),
    onStats: (stats) => emit('stats', stats),
    onTimeout: (err) => emit('timeout', err),
    onFullscreen: (fs) => emit('fullscreen', fs),
    onMute: (m) => emit('mute', m),
    onRecordStart: () => emit('recordStart'),
    onRecordEnd: (blob) => emit('recordEnd', blob),
    onRecording: (duration) => emit('recording', duration),
  });
}

let instance: JessibucaInstance | null = null;
let mounted = false;

async function createInstance() {
  await nextTick();
  if (!containerRef.value || instance) return;

  if (
    containerRef.value.clientWidth === 0 ||
    containerRef.value.clientHeight === 0
  ) {
    setTimeout(createInstance, 100);
    return;
  }

  const JessibucaConstructor = (window as any).Jessibuca;
  if (!JessibucaConstructor) {
    console.error('[JessibucaPlayer] 未找到 window.Jessibuca');
    emit('error', new Error('Jessibuca 库未加载'));
    return;
  }

  // 👇 核心修复：在实例化前，强行唤醒一次 AudioContext，如果被拦截就算了
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
    }
  } catch {}

  const resolvedConfig = {
    ...api.getResolvedConfig(),
    isMute: true,
    isNotMute: false,
  };

  instance = new JessibucaConstructor({
    container: containerRef.value,
    ...resolvedConfig,
  }) as unknown as JessibucaInstance;

  api.bindInstance(instance);
  api.clearRebuildFlag();
}

async function destroyInstance() {
  if (!instance) return;
  try {
    await api.destroyPlayer();
  } finally {
    instance = null;
  }
}

async function rebuildInstance() {
  await destroyInstance();
  await createInstance();
  if (api.store.state.url) {
    await api.play();
  }
}

watch(
  () => props.url,
  async (url, old) => {
    if (!url || url === old) return;
    api.setUrl(url);

    if (!mounted) return;
    if (!instance) await createInstance();
    if (api.store.state.config.autoPlay !== false) {
      await api.play();
    }
  },
);

watch(
  () => props.config,
  async (config) => {
    if (!config) return;
    api.setConfig(config);
    if (mounted && api.needsRebuild()) {
      await rebuildInstance();
    }
  },
  { deep: true },
);

onMounted(async () => {
  mounted = true;

  // 👇 强行解锁 AudioContext
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') void ctx.resume();
    }
  } catch {}

  if (props.url && !api.store.state.url) {
    api.setUrl(props.url);
  }
  if (props.config) {
    api.setConfig(props.config);
  }

  await createInstance();

  // 延迟播放，确保底层 Canvas 渲染完毕
  setTimeout(async () => {
    if (api.store.state.url && api.store.state.config.autoPlay !== false) {
      await api.play();
    }
  }, 300);
});

onBeforeUnmount(async () => {
  mounted = false;
  await destroyInstance();
  if (ownsApi) {
    await api.destroy();
  }
});

defineExpose({ api });
</script>

<template>
  <div
    ref="containerRef"
    class="jessibuca-player-wrapper"
    :class="props.class"
  ></div>
</template>

<style scoped>
.jessibuca-player-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #000;
}
</style>
