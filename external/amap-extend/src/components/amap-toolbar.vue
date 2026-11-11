<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '../core/types';

import { ref } from 'vue';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const emit = defineEmits<{
  locate: [coord: [number, number]];
}>();

const locating = ref(false);

function zoomIn() {
  props.api.setZoom(props.api.zoom.value + 1);
}

function zoomOut() {
  props.api.setZoom(props.api.zoom.value - 1);
}

function resetCenter() {
  props.api.setCenter([116.397, 39.892]);
  props.api.setZoom(15);
}

async function locate() {
  if (!('triggerGeolocation' in props.api)) return;
  if (locating.value) return;
  locating.value = true;
  try {
    // triggerGeolocation 方法本身会 setCenter，并返回坐标
    const coord = await (props.api as IAmap2dApi).triggerGeolocation();
    // 🔥 触发事件，让父组件去画标记
    emit('locate', coord);
  } catch (error) {
    console.warn('[AmapToolbar] 定位失败', error);
  } finally {
    locating.value = false;
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      class="rounded border border-border bg-accent px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent-foreground/10 disabled:opacity-50"
      @click="zoomIn"
    >
      放大
    </button>
    <button
      class="rounded border border-border bg-accent px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent-foreground/10 disabled:opacity-50"
      @click="zoomOut"
    >
      缩小
    </button>
    <button
      class="rounded border border-border bg-accent px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent-foreground/10 disabled:opacity-50"
      @click="resetCenter"
    >
      复位
    </button>
    <button
      class="rounded border border-border bg-accent px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent-foreground/10 disabled:opacity-50"
      :disabled="locating || !('triggerGeolocation' in props.api)"
      @click="locate"
    >
      {{ locating ? '定位中...' : '定位' }}
    </button>
  </div>
</template>
