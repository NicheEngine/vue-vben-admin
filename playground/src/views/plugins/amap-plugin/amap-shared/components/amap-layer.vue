<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { computed, ref, watch } from 'vue';

import { Checkbox, Divider } from 'antdv-next';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const is3d = computed(() => props.api.kind === '3d');

const isSatellite = ref(false);
const isTraffic = ref(false);
const showPoi = ref(true);
const showRoad = ref(true);
const showRoadNet = ref(false);

function updateLayers() {
  if (!props.api) return;

  const activeLayers = [
    ...(isSatellite.value ? ['satellite'] : []),
    ...(isTraffic.value ? ['traffic'] : []),
  ];
  props.api.setLayers(activeLayers);

  const features = ['bg', 'building'];
  if (showRoad.value || showRoadNet.value) features.push('road');
  if (showPoi.value || showRoadNet.value) features.push('point');
  props.api.setFeatures(features);
}

watch([isSatellite, isTraffic, showPoi, showRoad, showRoadNet], updateLayers, {
  immediate: true,
});
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <div class="flex flex-col gap-2">
      <div class="font-medium text-foreground/80">底图设置</div>
      <Checkbox v-model:checked="isSatellite">卫星影像</Checkbox>
      <div class="text-xs text-foreground/50">
        当前显示：{{ isSatellite ? '卫星影像' : '电子地图' }}
      </div>
    </div>

    <Divider class="!my-1" />

    <div class="flex flex-col gap-2">
      <div class="font-medium text-foreground/80">叠加与控制</div>
      <Checkbox v-model:checked="showPoi">显示地点文字</Checkbox>
      <Checkbox v-model:checked="showRoad">显示路网骨架</Checkbox>
      <!-- RoadNet 仅 2D 支持 -->
      <Checkbox v-if="!is3d" v-model:checked="showRoadNet">
        叠加道路注记层
      </Checkbox>
      <Checkbox v-model:checked="isTraffic">实时路况</Checkbox>
    </div>
  </div>
</template>
