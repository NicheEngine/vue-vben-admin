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
// ============================================================
// 全局共享的 AudioContext 单例
// ============================================================
let globalAudioCtx: AudioContext | null = null;
let globalAudioUnlocked = false;
function unlockAudioContext() {
  if (globalAudioUnlocked || typeof window === 'undefined') return;

  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = globalAudioCtx || new AudioCtx();
    if (!globalAudioCtx) {
      globalAudioCtx = ctx;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        globalAudioUnlocked = true;
      });
    } else {
      globalAudioUnlocked = true;
    }
  } catch (error) {
    console.warn('[JessibucaPlayer] AudioContext 解锁失败', error);
  }
}

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
    console.warn('[JessComp] 容器尺寸为 0，延迟 100ms 重试');
    setTimeout(createInstance, 100);
    return;
  }

  const JessibucaConstructor = (window as any).Jessibuca;
  if (!JessibucaConstructor) {
    console.error('[JessComp] window.Jessibuca 未找到');
    emit('error', new Error('Jessibuca 库未加载'));
    return;
  }
  const storeConfig = api.getResolvedConfig();
  // 核心修复：从 api store 里获取正确的配置（包含 external 传进来的 scaleMode）
  const currentScaleMode = api.store.state.config.scaleMode ?? 1;

  const config = {
    ...storeConfig,
    container: containerRef.value,
    isMute: storeConfig.isMute ?? true,
    videoBuffer: storeConfig.videoBuffer ?? 0.2,
    decoder: storeConfig.decoder || '/jessibuca/decoder.js',
    loadingText: storeConfig.loadingText || '加载中...',
    scaleMode: currentScaleMode,
  };

  try {
    instance = new JessibucaConstructor(config) as unknown as JessibucaInstance;
    api.bindInstance(instance);
    api.clearRebuildFlag();

    // 初始化后，立即应用一次 scaleMode 并 resize
    if (currentScaleMode !== undefined) {
      instance.setScaleMode(currentScaleMode);
      instance.resize();
    }
  } catch (error) {
    console.error('[JessComp] 💥 new Jessibuca 或 bindInstance 崩溃:', error);
  }
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
  () => props.config?.scaleMode,
  (mode) => {
    if (instance && mode !== undefined) {
      instance.setScaleMode(mode);
      instance.resize();
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

  // 解锁 AudioContext
  unlockAudioContext();

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
    class="jessibuca-player-wrapper relative flex items-center justify-center w-full h-full overflow-hidden bg-black"
    :class="props.class"
  ></div>
</template>
