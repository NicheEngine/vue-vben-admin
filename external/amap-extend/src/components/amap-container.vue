<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '../core/types';

defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const emit = defineEmits<{
  retry: [];
}>();

function handleRetry() {
  emit('retry');
}
</script>

<template>
  <div class="amap-container relative h-full w-full">
    <slot></slot>
    <div
      v-if="api.isLoading.value"
      class="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-white"
    >
      加载地图中...
    </div>
    <div
      v-if="api.error.value"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 text-white"
    >
      <p>错误：{{ api.error.value }}</p>
      <button
        class="mt-2 rounded bg-white/20 px-3 py-1 text-sm hover:bg-white/30"
        @click="handleRetry"
      >
        重试
      </button>
    </div>
  </div>
</template>
