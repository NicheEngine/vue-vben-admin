<script setup lang="ts">
import type { JessibucaConfig } from '@vben/jessibuca-player';
import type { IPlayerApi } from '@vben/player-types';

import type {
  AutoPlayerApi,
  AutoPlayerProps,
  AutoPlayerState,
  PlayerEngine,
} from './types';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import {
  createEasyAdapter,
  EasyPlayer,
  useEasyPlayer,
} from '@vben/easy-player';
import {
  createJessibucaAdapter,
  JessibucaPlayer,
  useJessibucaPlayer,
} from '@vben/jessibuca-player';
import {
  createLiveAdapter,
  LivePlayer,
  useLivePlayer,
} from '@vben/live-player';
import {
  createOssrsAdapter,
  OssrsPlayer,
  useOssrsPlayer,
} from '@vben/ossrs-player';

import { checkEasyPlayerReady, checkJessibucaReady } from './auto-check';
import { detectEngine } from './player-router';

const props = withDefaults(defineProps<AutoPlayerProps>(), {
  autoplay: true,
  muted: true,
  preferEngine: 'none',
});

const env = reactive({ hasJessibuca: false, hasEasyPlayer: false });
const isEnvReady = ref(false);

// ================= 初始化实例 =================
const ossrsApi = useOssrsPlayer({
  onError: (err: any) => {
    console.warn('[ossrs] player error:', err);
  },
})[1];
const liveApi = useLivePlayer({
  mpegtsMaxRetry: -1,
  onError: (err) => {
    console.warn('[live] player error:', err.message);
  },
})[1];

const jessibucaConfig: JessibucaConfig = {
  autoPlay: true,
  isMute: true,
  debug: false,
  decoder: '/jessibuca/decoder.js',
  timeout: 10,
  videoBuffer: 0.5,
  isResize: true,
  scaleMode: 1,
  supportDblclickFullscreen: true,
  useWebFullScreen: false,
  enableRecording: true,
  recordType: 'webm',
  loadingTimeoutReplay: false,
  heartTimeoutReplay: false,
  loadingTimeoutReplayTimes: 0,
  heartTimeoutReplayTimes: 0,
};

const jessibucaApi = useJessibucaPlayer({
  initialConfig: jessibucaConfig,
})[1];
const easyApi = useEasyPlayer({
  onError: (err: any) => {
    console.warn('[easy] player error:', err);
  },
})[1];

// ================= 统一转换为 Adapter =================
const adapters: Partial<Record<PlayerEngine, IPlayerApi>> = {
  ossrs: createOssrsAdapter(ossrsApi),
  live: createLiveAdapter(liveApi),
  jessibuca: createJessibucaAdapter(jessibucaApi),
  easy: createEasyAdapter(easyApi),
};

// ================= 引擎路由计算 =================
const activeEngine = computed(() => {
  if (!isEnvReady.value) return 'none';
  return detectEngine(props.url, {
    hasJessibuca: env.hasJessibuca,
    hasEasyPlayer: env.hasEasyPlayer,
    preferEngine: props.preferEngine,
  });
});

// ================= 聚合状态 (核心修复区) =================
// 使用 reactive 确保外部拿到的对象始终是同一个引用，响应式不会被打破
const activeState = reactive<AutoPlayerState>({
  isPlaying: false,
  isLoading: false,
  isReady: false,
  error: null,
  volume: 1,
  isMuted: true,
  videoWidth: 0,
  videoHeight: 0,
  currentTime: 0,
  networkDelay: 0,
  stats: {},
  isRecording: false,
  recordingDuration: 0,
  activeEngine: 'none',
});

// 监听引擎变化，重置状态并重新绑定底层 Ref
watch(
  activeEngine,
  (engine) => {
    activeState.activeEngine = engine;

    // 1. 重置基础状态
    Object.assign(activeState, {
      isPlaying: false,
      isLoading: false,
      isReady: false,
      error: null,
      videoWidth: 0,
      videoHeight: 0,
      currentTime: 0,
      networkDelay: 0,
      stats: {},
      isRecording: false,
      recordingDuration: 0,
    });

    const currentAdapter = adapters[engine];
    if (!currentAdapter) return;

    // 2. 使用数组监听强行收集底层所有 Ref，解决 LivePlayer 有时不触发的问题
    watch(
      () => ({
        playing: currentAdapter.isPlaying.value,
        loading: currentAdapter.isLoading.value,
        ready: currentAdapter.isReady.value,
        err: currentAdapter.error.value,
        vol: currentAdapter.volume.value,
        muted: currentAdapter.isMuted.value,
        w: currentAdapter.videoWidth.value,
        h: currentAdapter.videoHeight.value,
        ct: currentAdapter.currentTime.value,
        delay: currentAdapter.networkDelay.value,
        st: currentAdapter.stats.value,
        rec: currentAdapter.isRecording.value,
        recD: currentAdapter.recordingDuration.value,
      }),
      (val) => {
        activeState.isPlaying = val.playing;
        activeState.isLoading = val.loading;
        activeState.isReady = val.ready;
        activeState.error = val.err;
        activeState.volume = val.vol;
        activeState.isMuted = val.muted;
        activeState.videoWidth = val.w;
        activeState.videoHeight = val.h;
        activeState.currentTime = val.ct;
        activeState.networkDelay = val.delay;
        activeState.stats = val.st;
        activeState.isRecording = val.rec;
        activeState.recordingDuration = val.recD;
      },
      { immediate: true },
    );
  },
  { immediate: true },
);

// ================= 监听外部配置变化 =================
// 1. 静音同步
watch(
  [() => props.muted, activeEngine],
  ([muted, engine]) => {
    const currentAdapter = adapters[engine];
    if (currentAdapter) {
      currentAdapter.setMuted?.(muted);
    }
  },
  { immediate: true },
);

// 2. 自动播放控制
watch(
  () => props.autoplay,
  (autoplay) => {
    if (!autoplay) {
      Object.values(adapters).forEach((adapter) => {
        adapter?.pause?.();
      });
    }
  },
  { immediate: true },
);

// 3. URL 注入
watch(
  [() => props.url, () => activeEngine.value],
  ([newUrl, engine]) => {
    if (!newUrl || !engine || engine === 'none') return;
    const adapter = adapters[engine];
    if (adapter) {
      adapter.setUrl(newUrl);
    }
  },
  { immediate: true },
);

// ================= 统一暴露代理 API =================
const proxyApi: AutoPlayerApi = {
  getActiveEngine: () => activeEngine.value,
  getRawInstance: () => {
    const map: any = {
      ossrs: ossrsApi,
      live: liveApi,
      jessibuca: jessibucaApi,
      easy: easyApi,
    };
    return map[activeEngine.value] || null;
  },
  play: async () => await adapters[activeEngine.value]?.play?.(),
  pause: async () => await adapters[activeEngine.value]?.pause?.(),
  toggle: async () => await adapters[activeEngine.value]?.toggle?.(),
  setVolume: (v: number) => adapters[activeEngine.value]?.setVolume?.(v),
  setMuted: (m: boolean) => adapters[activeEngine.value]?.setMuted?.(m),
  setUrl: (u: string) => adapters[activeEngine.value]?.setUrl?.(u),
  setScaleMode: (mode: 0 | 1 | 2) =>
    adapters[activeEngine.value]?.setScaleMode?.(mode),
  screenshot: (opts?: any) => adapters[activeEngine.value]?.screenshot?.(opts),
  startRecord: () => adapters[activeEngine.value]?.startRecord?.(),
  stopRecordAndSave: () => adapters[activeEngine.value]?.stopRecordAndSave?.(),
  requestFullscreen: async () =>
    await adapters[activeEngine.value]?.requestFullscreen?.(),
  exitFullscreen: async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  },
  destroy: async () => {
    ossrsApi.destroy();
    liveApi.destroy();
    jessibucaApi.destroy();
    easyApi.destroy();
  },
  // 👈 直接暴露 reactive 对象
  state: activeState,
};

// 暴露给父组件
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
    <template v-else>
      <div v-if="activeEngine === 'ossrs'" class="absolute inset-0">
        <OssrsPlayer
          :api="ossrsApi"
          :url="props.url"
          :autoplay="props.autoplay"
          :muted="props.muted"
          class="w-full h-full"
        />
      </div>

      <div v-else-if="activeEngine === 'live'" class="absolute inset-0">
        <LivePlayer
          :api="liveApi"
          :url="props.url"
          :autoplay="props.autoplay"
          :muted="props.muted"
          class="w-full h-full"
        />
      </div>

      <div v-else-if="activeEngine === 'jessibuca'" class="absolute inset-0">
        <JessibucaPlayer
          :api="jessibucaApi"
          :url="props.url"
          class="w-full h-full"
        />
      </div>

      <div v-else-if="activeEngine === 'easy'" class="absolute inset-0">
        <EasyPlayer
          :player-api="easyApi"
          :video-url="props.url"
          class="w-full h-full"
        />
      </div>

      <div
        v-else
        class="absolute inset-0 flex items-center justify-center bg-black text-foreground/40 text-sm"
      >
        {{ !props.url ? '请输入流媒体地址' : '当前环境无可用播放器' }}
      </div>
    </template>
  </div>
</template>
