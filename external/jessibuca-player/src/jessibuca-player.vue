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

/** 是否由组件内部自建 api（决定卸载时是否销毁 api） */
const ownsApi = !props.api;

const api =
  props.api ??
  new JessibucaPlayerApi({
    config: props.config,
    url: props.url,
  });

/**
 * 合并回调：外部回调（useJessibucaPlayer 传入）先执行，再 emit。
 * 这样既保留外部回调，又能让父组件通过 @play / @error 等监听。
 * 注意：emit 的事件名和外部回调是两套，互不覆盖。
 */
const externalCallbacks = api.getCallbacks();

api.setCallbacks({
  onPlay: () => {
    externalCallbacks.onPlay?.();
    emit('play');
  },
  onPause: () => {
    externalCallbacks.onPause?.();
    emit('pause');
  },
  onError: (err) => {
    externalCallbacks.onError?.(err);
    emit('error', err);
  },
  onLoad: () => {
    externalCallbacks.onLoad?.();
    emit('load');
  },
  onVideoInfo: (info) => {
    externalCallbacks.onVideoInfo?.(info);
    emit('videoInfo', info);
  },
  onStats: (stats) => {
    externalCallbacks.onStats?.(stats);
    emit('stats', stats);
  },
  onTimeout: (err) => {
    externalCallbacks.onTimeout?.(err);
    emit('timeout', err);
  },
  onFullscreen: (fs) => {
    externalCallbacks.onFullscreen?.(fs);
    emit('fullscreen', fs);
  },
  onMute: (m) => {
    externalCallbacks.onMute?.(m);
    emit('mute', m);
  },
  onRecordStart: () => {
    externalCallbacks.onRecordStart?.();
    emit('recordStart');
  },
  onRecordEnd: (blob) => {
    externalCallbacks.onRecordEnd?.(blob);
    emit('recordEnd', blob);
  },
  onRecording: (duration) => {
    externalCallbacks.onRecording?.(duration);
    emit('recording', duration);
  },
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
  api.clearRebuildFlag();
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

/** 销毁并重建（config 结构性变化时用） */
async function rebuildInstance() {
  await destroyInstance();
  await createInstance();
  // 重建后若之前在播放，恢复播放
  if (api.store.state.url) {
    await api.play();
  }
}

/**
 * url 变化：同步到 api.store.state.url。
 * 播放一律以 store.url 为准，避免 props.url / state.url 双份数据源。
 * 若正在播放，则用新 url 重播（单一重播入口）。
 */
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

/**
 * config 变化：合并到 store。
 * 若 api 标记需要重建（结构性配置变化），销毁重建实例。
 */
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
  // 首次挂载：把 props 的初始值同步到 store
  if (props.url && !api.store.state.url) {
    api.setUrl(props.url);
  }
  if (props.config) {
    api.setConfig(props.config);
  }
  await createInstance();

  if (api.store.state.url && api.store.state.config.autoPlay !== false) {
    await api.play();
  }
});

onBeforeUnmount(async () => {
  mounted = false;
  await destroyInstance();
  // 只有组件自建的 api 才由组件销毁；外部注入的交给调用方
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
