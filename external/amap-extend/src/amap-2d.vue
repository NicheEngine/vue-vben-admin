<script lang="ts" setup>
import type { Amap2dConfig, IAmap2dApi } from './core/types';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createAmap2dAdapter } from './core/adapter-2d';

const props = withDefaults(
  defineProps<{
    config?: Amap2dConfig;
    /** 外部注入 api（useAmap2d 场景） */
    api?: IAmap2dApi;
  }>(),
  {
    config: () => ({}),
    api: undefined,
  },
);

const containerRef = ref<HTMLElement>();
const ownsApi = !props.api;
const api = props.api ?? createAmap2dAdapter();

let mounted = false;

async function mountMap() {
  if (!containerRef.value) return;
  try {
    await api.init(containerRef.value, props.config);
    mounted = true;
  } catch (error) {
    console.error('[Amap2d] 地图初始化失败', error);
  }
}

watch(
  () => props.config,
  async (cfg) => {
    if (!mounted) return;
    // 这里可以做配置热更新（比如 setCenter / setZoom）
    if (cfg.center) api.setCenter(cfg.center);
    if (cfg.zoom !== undefined) api.setZoom(cfg.zoom);
  },
  { deep: true },
);

onMounted(() => {
  void mountMap();
});

onBeforeUnmount(async () => {
  if (ownsApi) {
    await api.destroy();
  }
});

defineExpose({ api });
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full w-full overflow-hidden bg-gray-100"
  ></div>
</template>
