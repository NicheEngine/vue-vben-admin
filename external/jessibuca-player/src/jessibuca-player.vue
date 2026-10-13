<script setup lang="ts">
import type { JessibucaInstance, JessibucaPlayerProps } from './types';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { JessibucaPlayerApi } from './jessibuca-player-api';

/**
 * api 由外部（useJessibucaPlayer）创建并通过 props 注入，
 * 组件内部不再自己 new，保证外部和组件共用同一实例。
 */
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

const api =
  props.api ??
  new JessibucaPlayerApi({
    config: props.config,
    url: props.url,
  });

// 把组件事件挂到 api 上（覆盖外部回调）
api.attachCallbacks({
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

let instance: JessibucaInstance | null = null;
let mounted = false;

/** 创建底层 Jessibuca 实例 */
async function createInstance() {
  await nextTick();
  if (!containerRef.value || instance) return;

  const JessibucaConstructor = (window as any).Jessibuca;
  if (!JessibucaConstructor) {
    console.error(
      '[JessibucaPlayer] 未找到 window.Jessibuca，请确保 jessibuca.js 已加载',
    );
    emit('error', new Error('Jessibuca 库未加载'));
    return;
  }

  const resolvedConfig = api.getResolvedConfig();
  // oxlint-disable-next-line no-console
  console.log(
    '[JessibucaPlayer] create instance with config =',
    resolvedConfig,
  );

  instance = new JessibucaConstructor({
    container: containerRef.value,
    ...resolvedConfig,
  }) as unknown as JessibucaInstance;

  api.bindInstance(instance);
}

/** 销毁实例 */
async function destroyInstance() {
  if (!instance) return;
  try {
    await api.destroyPlayer();
  } finally {
    instance = null;
  }
}

// URL 变化：同步 store，并主动重播
watch(
  () => props.url,
  async (url, old) => {
    if (!url || url === old) return;
    api.setUrl(url);

    if (!mounted) return;
    if (!instance) await createInstance();
    await api.play();
  },
);

// config 变化：合并到 store
watch(
  () => props.config,
  (config) => {
    if (!config) return;
    api.setConfig(config);
  },
  { deep: true },
);

onMounted(async () => {
  mounted = true;
  await createInstance();
  if (props.url && api.store.state.config.autoPlay !== false) {
    await api.play();
  }
});

onBeforeUnmount(async () => {
  mounted = false;
  await destroyInstance();
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
