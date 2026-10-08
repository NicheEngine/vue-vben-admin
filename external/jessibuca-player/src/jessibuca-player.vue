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
const api = new JessibucaPlayerApi({
  config: props.config,
  url: props.url,
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

// 监听 URL 变化，自动重新播放
watch(
  () => props.url,
  (url, old) => {
    if (url && url !== old) {
      api.setUrl(url);
    }
  },
);

// 监听配置变化
watch(
  () => props.config,
  (config) => {
    api.store.setState((prev) => ({
      ...prev,
      config: { ...prev.config, ...config },
    }));
  },
  { deep: true },
);

onMounted(async () => {
  await nextTick();
  if (!containerRef.value) return;

  // 改为从 window 上获取，而不是 import
  const JessibucaConstructor = window.Jessibuca;
  if (!JessibucaConstructor) {
    console.error(
      '[JessibucaPlayer] 未找到 window.Jessibuca，请确保 jessibuca.js 已加载',
    );
    emit('error', new Error('Jessibuca 库未加载'));
    return;
  }

  const instance = new JessibucaConstructor({
    container: containerRef.value,
    ...api.store.state.config,
  });
  api.bindInstance(instance as unknown as JessibucaInstance);

  // 自动播放
  if (props.url && api.store.state.config.autoPlay !== false) {
    await api.play();
  }
});

onBeforeUnmount(async () => {
  await api.destroy();
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
