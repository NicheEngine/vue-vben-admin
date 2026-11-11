<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '../core/types';

import { computed } from 'vue';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const is3d = computed(() => 'pitch' in props.api);
</script>

<template>
  <div class="space-y-1 text-xs text-foreground/70">
    <div>中心点：{{ api.center.value.join(', ') }}</div>
    <div>缩放：{{ api.zoom.value }}</div>
    <div v-if="api.mousePosition.value">
      鼠标：{{ api.mousePosition.value.join(', ') }}
    </div>
    <div>中心地址：{{ api.currentAddress.value || '解析中...' }}</div>
    <div>覆盖物数量：{{ api.overlays.value.length }}</div>
    <template v-if="is3d">
      <div>俯仰角：{{ (props.api as IAmap3dApi).pitch.value }}°</div>
      <div>旋转角：{{ (props.api as IAmap3dApi).rotation.value }}°</div>
    </template>
  </div>
</template>
