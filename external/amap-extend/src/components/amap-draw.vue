<script lang="ts" setup>
import type { IAmap2dApi } from '../core/types';

import { ref } from 'vue';

const props = defineProps<{
  api: IAmap2dApi;
}>();

const drawingMode = ref<'circle' | 'marker' | 'none' | 'polygon' | 'polyline'>(
  'none',
);

function startDraw(mode: 'circle' | 'marker' | 'polygon' | 'polyline') {
  props.api.startDraw(mode);
  drawingMode.value = mode;
}

function clear() {
  props.api.stopDraw();
  props.api.clearOverlays();
  drawingMode.value = 'none';
}

function cancelDraw() {
  props.api.stopDraw();
  drawingMode.value = 'none';
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap gap-2">
      <button
        class="rounded border border-border px-3 py-1 text-sm transition-colors"
        :class="[
          drawingMode === 'marker'
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-accent text-foreground hover:bg-accent-foreground/10',
        ]"
        @click="startDraw('marker')"
      >
        点标记
      </button>
      <button
        class="rounded border border-border px-3 py-1 text-sm transition-colors"
        :class="[
          drawingMode === 'circle'
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-accent text-foreground hover:bg-accent-foreground/10',
        ]"
        @click="startDraw('circle')"
      >
        画圆
      </button>
      <button
        class="rounded border border-border px-3 py-1 text-sm transition-colors"
        :class="[
          drawingMode === 'polygon'
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-accent text-foreground hover:bg-accent-foreground/10',
        ]"
        @click="startDraw('polygon')"
      >
        画多边形
      </button>
      <button
        class="rounded border border-border px-3 py-1 text-sm transition-colors"
        :class="[
          drawingMode === 'polyline'
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-accent text-foreground hover:bg-accent-foreground/10',
        ]"
        @click="startDraw('polyline')"
      >
        画线
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-if="drawingMode !== 'none'"
        class="rounded border border-border bg-accent px-3 py-1 text-sm text-foreground hover:bg-accent-foreground/10"
        @click="cancelDraw"
      >
        取消绘制
      </button>
      <button
        class="rounded border border-destructive/30 bg-destructive/10 px-3 py-1 text-sm text-destructive hover:bg-destructive/20"
        @click="clear"
      >
        清除画面
      </button>
    </div>
  </div>
</template>
