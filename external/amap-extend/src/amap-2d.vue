<script lang="ts" setup>
import type { Amap2dConfig, AmapEventType, IAmap2dApi } from './core/types';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createAmap2dAdapter } from './core/adapter-2d';

const props = withDefaults(
  defineProps<{
    config?: Amap2dConfig;
    api?: IAmap2dApi;
  }>(),
  {
    config: () => ({}),
    api: undefined,
  },
);

const emit = defineEmits<{
  click: [e: any];
  moveend: [e: any];
  zoomchange: [e: any];
}>();

const containerRef = ref<HTMLElement>();
const ownsApi = !props.api;
const api = props.api ?? createAmap2dAdapter();

let mounted = false;
const offHandlers: Array<() => void> = [];

/** config → 命令 映射表 */
const configHandlers: Record<string, (v: any) => void> = {
  center: (v) => api.setCenter(v),
  zoom: (v) => api.setZoom(v),
  layers: (v) => api.setLayers(v),
  features: (v) => api.setFeatures(v),
};

async function mountMap() {
  if (!containerRef.value) return;
  try {
    await api.init(containerRef.value, props.config);
    mounted = true;
    // 事件透传
    const evts: AmapEventType[] = ['click', 'moveend', 'zoomchange'];
    for (const evt of evts) {
      offHandlers.push(api.on(evt, (e) => emit(evt as any, e)));
    }
  } catch (error) {
    console.error('[Amap2d] 地图初始化失败', error);
  }
}

watch(
  () => props.config,
  (cfg, prev) => {
    if (!mounted || !prev) return;
    for (const key of Object.keys(cfg ?? {})) {
      if ((cfg as any)[key] !== (prev as any)[key]) {
        configHandlers[key]?.((cfg as any)[key]);
      }
    }
  },
  { deep: true },
);

onMounted(() => void mountMap());

onBeforeUnmount(async () => {
  offHandlers.forEach((off) => off());
  offHandlers.length = 0;
  if (ownsApi) await api.destroy();
});

defineExpose({ api });
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full w-full overflow-hidden bg-gray-100"
  ></div>
</template>
