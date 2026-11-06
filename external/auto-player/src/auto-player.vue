<script setup lang="ts">
import type { IPlayerApi, PlayerCapabilities } from '@vben/player-types';

import type { AutoPlayerApi, AutoPlayerProps } from './types';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { createEasyAdapter, useEasyPlayer } from '@vben/easy-player';
import {
  createJessibucaAdapter,
  useJessibucaPlayer,
} from '@vben/jessibuca-player';
import { createLiveAdapter, useLivePlayer } from '@vben/live-player';
import { createOssrsAdapter, useOssrsPlayer } from '@vben/ossrs-player';

import { checkEasyPlayerReady, checkJessibucaReady } from './auto-check';
import { detectEngine } from './player-router';

const props = withDefaults(defineProps<AutoPlayerProps>(), {
  autoplay: true,
  muted: true,
  preferEngine: 'none',
});

const env = reactive({ hasJessibuca: false, hasEasyPlayer: false });
const isEnvReady = ref(false);

// 计算当前应该用哪个引擎
const activeEngine = computed(() => {
  if (!isEnvReady.value) return 'none';
  return detectEngine(props.url, {
    hasJessibuca: env.hasJessibuca,
    hasEasyPlayer: env.hasEasyPlayer,
    preferEngine: props.preferEngine,
  });
});

// 使用 shallowRef 挂载当前活跃的底层实例和 Component
const activeComponent = shallowRef<any>(null);
const activeApiInstance = shallowRef<any>(null);
const activeAdapter = shallowRef<IPlayerApi | null>(null);

// 状态机挂载：根据引擎变化，动态创建对应的实例
watch(
  activeEngine,
  (engine) => {
    // 1. 统一清理旧实例，依赖 Vue 的 unmount 机制去销毁底层
    activeComponent.value = null;
    activeApiInstance.value = null;
    activeAdapter.value = null;

    if (engine === 'none') return;

    // 2. 按需初始化引擎
    if (engine === 'ossrs') {
      const [Comp, api] = useOssrsPlayer(props.ossrsOptions);
      activeComponent.value = Comp;
      activeApiInstance.value = api;
      activeAdapter.value = createOssrsAdapter(api);
    } else if (engine === 'live') {
      const [Comp, api] = useLivePlayer(props.liveOptions);
      activeComponent.value = Comp;
      activeApiInstance.value = api;
      activeAdapter.value = createLiveAdapter(api);
    } else if (engine === 'jessibuca') {
      const [Comp, api] = useJessibucaPlayer(props.jessibucaOptions);
      activeComponent.value = Comp;
      activeApiInstance.value = api;
      activeAdapter.value = createJessibucaAdapter(api);
    } else if (engine === 'easy') {
      const [Comp, api] = useEasyPlayer(props.easyOptions);
      activeComponent.value = Comp;
      activeApiInstance.value = api;
      activeAdapter.value = createEasyAdapter(api);
    }
  },
  { immediate: true },
);

// 1. 只监听 URL 和 引擎的变化，触发换流
watch(
  [() => props.url, activeEngine],
  ([url, engine]) => {
    if (!activeAdapter.value || !url || engine === 'none') return;

    activeAdapter.value.setMuted(props.muted);
    activeAdapter.value.setUrl(url);

    if (props.autoplay) {
      setTimeout(() => activeAdapter.value?.play(), 100);
    }
  },
  { immediate: true },
);

// 2. 单独监听静音
watch(
  () => props.muted,
  (muted) => {
    activeAdapter.value?.setMuted?.(muted);
  },
);

// 3. 单独监听自动播放
watch(
  () => props.autoplay,
  (autoplay) => {
    if (!autoplay) {
      activeAdapter.value?.pause?.();
    } else if (activeAdapter.value && !activeAdapter.value.isPlaying.value) {
      activeAdapter.value?.play?.();
    }
  },
);

// ================= 核心代理层 =================
// ✅ 修复：直接暴露底层的 Ref，不再包装 computed，消除重复定义
const proxyApi: AutoPlayerApi = {
  getActiveEngine: () => activeEngine.value,
  getRawInstance: () => activeApiInstance.value,

  get isPlaying() {
    return activeAdapter.value?.isPlaying || computed(() => false);
  },
  get isLoading() {
    return activeAdapter.value?.isLoading || computed(() => false);
  },
  get isReady() {
    return activeAdapter.value?.isReady || computed(() => false);
  },
  get error() {
    return activeAdapter.value?.error || computed(() => null);
  },
  get volume() {
    return activeAdapter.value?.volume || computed(() => 1);
  },
  get isMuted() {
    return activeAdapter.value?.isMuted || computed(() => true);
  },
  get videoWidth() {
    return activeAdapter.value?.videoWidth || computed(() => 0);
  },
  get videoHeight() {
    return activeAdapter.value?.videoHeight || computed(() => 0);
  },
  get currentTime() {
    return activeAdapter.value?.currentTime || computed(() => 0);
  },
  get networkDelay() {
    return activeAdapter.value?.networkDelay || computed(() => 0);
  },
  get isRecording() {
    return activeAdapter.value?.isRecording || computed(() => false);
  },
  get recordingDuration() {
    return activeAdapter.value?.recordingDuration || computed(() => 0);
  },
  get scaleMode() {
    return activeAdapter.value?.scaleMode || computed(() => 1);
  },
  get stats() {
    return (
      activeAdapter.value?.stats ||
      computed(() => ({ buf: 0, fps: 0, vbps: 0 }))
    );
  },

  get capabilities(): PlayerCapabilities {
    return (
      activeAdapter.value?.capabilities ?? {
        screenshot: false,
        record: false,
        scaleMode: false,
        stats: false,
        seek: false,
        fullscreen: false,
      }
    );
  },

  // 代理所有操作
  play: async () => await activeAdapter.value?.play?.(),
  pause: async () => await activeAdapter.value?.pause?.(),
  toggle: async () => await activeAdapter.value?.toggle?.(),
  setVolume: (v) => activeAdapter.value?.setVolume?.(v),
  setMuted: (m) => activeAdapter.value?.setMuted?.(m),
  setUrl: (u) => activeAdapter.value?.setUrl?.(u),
  setScaleMode: (m) => activeAdapter.value?.setScaleMode?.(m),
  screenshot: (opts) => activeAdapter.value?.screenshot?.(opts),
  startRecord: (n, t) => activeAdapter.value?.startRecord?.(n, t),
  stopRecordAndSave: () => activeAdapter.value?.stopRecordAndSave?.(),
  requestFullscreen: async () =>
    await activeAdapter.value?.requestFullscreen?.(),
  exitFullscreen: async () => await activeAdapter.value?.exitFullscreen?.(),

  destroy: async () => {
    await activeAdapter.value?.destroy();
    activeAdapter.value = null;
  },
};

defineExpose({ api: proxyApi });

onMounted(async () => {
  env.hasJessibuca = await checkJessibucaReady();
  env.hasEasyPlayer = checkEasyPlayerReady();
  isEnvReady.value = true;
});

onBeforeUnmount(() => {
  proxyApi.destroy();
});
</script>

<template>
  <div
    class="relative flex w-full overflow-hidden bg-black"
    :class="props.class"
  >
    <div
      v-if="!isEnvReady"
      class="flex h-full w-full items-center justify-center text-white/50"
    >
      环境检测中...
    </div>
    <div
      v-else-if="activeEngine === 'none' || !activeComponent"
      class="absolute inset-0 flex items-center justify-center bg-black text-foreground/40 text-sm"
    >
      {{ !props.url ? '请输入流媒体地址' : '当前环境无可用播放器' }}
    </div>

    <!-- 动态渲染底层播放器组件 -->
    <div v-else class="absolute inset-0">
      <component
        :is="activeComponent"
        v-bind="{
          url: props.url,
          'video-url': props.url,
          api: activeApiInstance,
          'player-api': activeApiInstance,
          autoplay: props.autoplay,
          muted: props.muted,
          class: 'w-full h-full',
        }"
      />
    </div>
  </div>
</template>
