<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '../core/types';

import { ref, watch } from 'vue';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const isSatellite = ref(false);
const isTraffic = ref(false);
const showPoi = ref(true);
const showRoad = ref(true);

// 🔥 新增：道路注记状态
const showRoadNet = ref(false);

function updateLayers() {
  if (!props.api) return;

  const activeLayers = [
    ...(isSatellite.value ? ['satellite'] : []),
    ...(isTraffic.value ? ['traffic'] : []),
  ];

  props.api.setLayers(activeLayers);

  const features = ['bg', 'building'];

  // 🔥 只要“显示路网骨架”或“叠加道路注记层”任意一个为 true，就显示路网骨架
  if (showRoad.value || showRoadNet.value) {
    features.push('road');
  }

  // 🔥 只要“显示地点文字”或“叠加道路注记层”任意一个为 true，就显示文字
  if (showPoi.value || showRoadNet.value) {
    features.push('point');
  }

  props.api.setFeatures(features);
}

watch([isSatellite, isTraffic, showPoi, showRoad, showRoadNet], updateLayers, {
  immediate: true,
});
</script>

<template>
  <div class="flex flex-col gap-4 text-sm">
    <div class="flex flex-col gap-3">
      <div class="font-medium text-foreground/80">底图设置</div>

      <label class="flex cursor-pointer items-center gap-3">
        <input
          v-model="isSatellite"
          type="checkbox"
          class="h-4 w-4 rounded border-border accent-blue-600 cursor-pointer"
        />
        <span class="text-foreground">卫星影像</span>
      </label>
      <div class="text-xs text-foreground/50">
        当前显示：{{ isSatellite ? '卫星影像' : '电子地图' }}
      </div>
    </div>

    <div class="h-px w-full bg-border"></div>

    <div class="flex flex-col gap-3">
      <div class="font-medium text-foreground/80">叠加与控制</div>

      <label class="flex cursor-pointer items-center gap-3">
        <input
          v-model="showPoi"
          type="checkbox"
          class="h-4 w-4 rounded border-border accent-blue-600 cursor-pointer"
        />
        <span class="text-foreground">显示地点文字</span>
      </label>

      <label class="flex cursor-pointer items-center gap-3">
        <input
          v-model="showRoad"
          type="checkbox"
          class="h-4 w-4 rounded border-border accent-blue-600 cursor-pointer"
        />
        <span class="text-foreground">显示路网骨架</span>
      </label>

      <!-- 🔥 恢复道路注记选项 -->
      <label class="flex cursor-pointer items-center gap-3">
        <input
          v-model="showRoadNet"
          type="checkbox"
          class="h-4 w-4 rounded border-border accent-blue-600 cursor-pointer"
        />
        <span class="text-foreground">叠加道路注记层</span>
      </label>

      <label class="flex cursor-pointer items-center gap-3">
        <input
          v-model="isTraffic"
          type="checkbox"
          class="h-4 w-4 rounded border-border accent-blue-600 cursor-pointer"
        />
        <span class="text-foreground">实时路况</span>
      </label>
    </div>
  </div>
</template>
