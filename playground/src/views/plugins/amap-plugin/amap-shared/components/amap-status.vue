<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { computed } from 'vue';

import { formatAddress, formatPoint } from '../utils';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const is3d = computed(() => props.api.kind === '3d');
const api3d = computed(() => (is3d.value ? (props.api as IAmap3dApi) : null));
</script>

<template>
  <div class="text-xs text-foreground/80 space-y-1">
    <div class="flex justify-between border-b border-border/50 pb-1">
      <span class="text-foreground/50">中心点：</span>
      <span>{{ formatPoint(api.center.value) }}</span>
    </div>
    <div class="flex justify-between border-b border-border/50 pb-1">
      <span class="text-foreground/50">缩放：</span>
      <span>{{ api.zoom.value }}</span>
    </div>
    <div
      v-if="api.mousePosition.value"
      class="flex justify-between border-b border-border/50 pb-1"
    >
      <span class="text-foreground/50">鼠标：</span>
      <span>{{ formatPoint(api.mousePosition.value) }}</span>
    </div>
    <div class="flex justify-between border-b border-border/50 pb-1">
      <span class="text-foreground/50">中心地址：</span>
      <span
        class="truncate max-w-[180px]"
        :title="formatAddress(api.currentAddress.value)"
      >
        {{ formatAddress(api.currentAddress.value) }}
      </span>
    </div>
    <div class="flex justify-between border-b border-border/50 pb-1">
      <span class="text-foreground/50">覆盖物数量：</span>
      <span>{{ api.overlays.value.length }}</span>
    </div>
    <template v-if="api3d">
      <div class="flex justify-between border-b border-border/50 pb-1">
        <span class="text-foreground/50">俯仰角：</span>
        <span>{{ api3d.pitch.value }}°</span>
      </div>
      <div class="flex justify-between">
        <span class="text-foreground/50">旋转角：</span>
        <span>{{ api3d.rotation.value }}°</span>
      </div>
    </template>
  </div>
</template>
