<script lang="ts" setup>
import type { Amap3dConfig, IAmap3dApi } from './core/types';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createAmap3dAdapter } from './core/adapter-3d';

const props = withDefaults(
  defineProps<{
    config?: Amap3dConfig;
    api?: IAmap3dApi;
  }>(),
  {
    config: () => ({}),
    api: undefined,
  },
);

const containerRef = ref<HTMLElement>();
const ownsApi = !props.api;
const api = props.api ?? createAmap3dAdapter();

let mounted = false;

watch(
  () => props.config,
  async (cfg) => {
    if (!mounted) return;
    if (cfg.center) api.setCenter(cfg.center);
    if (cfg.zoom !== undefined) api.setZoom(cfg.zoom);
    if (cfg.pitch !== undefined) api.setPitch(cfg.pitch);
    if (cfg.rotation !== undefined) api.setRotation(cfg.rotation);
  },
  { deep: true },
);

async function mountMap() {
  if (!containerRef.value) return;
  try {
    await api.init(containerRef.value, props.config);
    mounted = true;
  } catch (error) {
    console.error('[Amap3d] 地图初始化失败', error);
  }
}

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
