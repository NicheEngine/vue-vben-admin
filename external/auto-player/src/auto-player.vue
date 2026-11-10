<script lang="ts" setup>
import type { AutoPlayerProps } from './types';

import { computed, onBeforeUnmount, shallowRef } from 'vue';

import { AutoPlayerApi } from './auto-player-api';

const props = withDefaults(defineProps<AutoPlayerProps>(), {
  autoplay: true,
  muted: true,
  scaleMode: 1,
  isH265: false,
  latency: 'normal',
  objectFit: 'contain',
});

const emit = defineEmits<{
  play: [];
  pause: [];
  error: [error: Error | string];
  timeupdate: [t: number];
  engineChange: [type: string];
}>();

const ownsApi = !props.api;
const api =
  props.api ??
  new AutoPlayerApi({
    initialUrl: props.url,
    initialType: props.type,
    isH265: props.isH265,
    latency: props.latency,
    muted: props.muted,
    autoplay: props.autoplay,
    scaleMode: props.scaleMode,
  });

const autoApi = api as AutoPlayerApi;

// 本地响应式镜像引擎信息（依赖 engineChange 事件更新）
const currentComponent = shallowRef<any>(null);
const engineType = shallowRef<null | string>(null);

const syncEngine = () => {
  currentComponent.value = (api as any).getComponent?.() ?? null;
  engineType.value = (api as any).getEngineType?.() ?? null;
};

const offEngine = (api as any).onEngineChange?.((t: string) => {
  syncEngine();
  emit('engineChange', t);
});

// 初始同步（若 api 已在外部 init 过）
syncEngine();

if (ownsApi) {
  void autoApi.init(props.url).then(syncEngine);
}

// 映射后的 props（按引擎差异化）
// 映射后的 props（按引擎差异化）
const mappedProps = computed(() => {
  const base: Record<string, any> = { class: props.class };
  const raw = (api as any).getRawApi?.() ?? null;
  const currentMuted = autoApi.isMuted?.value ?? props.muted;

  // 核心修改：优先使用外部 props.scaleMode（多屏场景），其次是 autoApi.scaleMode.value（单屏场景）
  const currentScaleMode = props.scaleMode ?? autoApi.scaleMode.value;

  // 根据 scaleMode 计算 objectFit
  const fitMap: Record<0 | 1 | 2, string> = {
    0: 'fill',
    1: 'contain',
    2: 'cover',
  };
  const fit = fitMap[currentScaleMode as 0 | 1 | 2] ?? 'contain';

  switch (engineType.value) {
    case 'easy': {
      return {
        ...base,
        'player-api': raw,
        'video-url': props.url,
        'scale-mode': currentScaleMode,
        muted: currentMuted,
        autoplay: props.autoplay,
      };
    }
    case 'jessibuca': {
      return {
        ...base,
        key: `jess-${currentScaleMode}`,
        api: raw,
        url: props.url,
        config: {
          isMute: currentMuted,
          autoPlay: props.autoplay,
          scaleMode: currentScaleMode,
          isH265: props.isH265,
        },
      };
    }
    case 'live': {
      return {
        ...base,
        url: props.url,
        muted: currentMuted,
        autoplay: props.autoplay,
        'object-fit': fit,
      };
    }
    case 'ossrs': {
      const isWhep =
        props.url.toLowerCase().includes('/whep/') ||
        props.url.toLowerCase().includes('/whip-play/');
      return {
        ...base,
        api: raw,
        url: props.url,
        protocol: isWhep ? 'whep' : 'rtc',
        muted: currentMuted,
        autoplay: props.autoplay,
        'object-fit': fit,
      };
    }
    default: {
      return base;
    }
  }
});

onBeforeUnmount(() => {
  offEngine?.();
  if (ownsApi) void autoApi.destroy();
});

defineExpose({ api: autoApi });
</script>

<template>
  <div
    class="auto-player-wrapper relative h-full w-full overflow-hidden bg-black"
  >
    <component
      :is="currentComponent"
      v-if="currentComponent"
      v-bind="mappedProps"
    />
    <div
      v-else
      class="absolute inset-0 flex items-center justify-center text-xs text-white/40"
    >
      正在选择播放器引擎...
    </div>
  </div>
</template>
