<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { computed, ref, watch } from 'vue';

import { Checkbox, Divider, RadioButton, RadioGroup } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const is3d = computed(() => props.api.kind === '3d');

const isSatellite = ref(false);
const isTraffic = ref(false);
const showPoi = ref(true);
const showRoad = ref(true);
const showRoadNet = ref(false);

// 新增：主题控制
const mapTheme = ref<'dark' | 'light' | 'normal'>('normal');

function updateLayers() {
  if (!props.api) return;

  const activeLayers = [
    ...(isSatellite.value ? ['satellite'] : []),
    ...(isTraffic.value ? ['traffic'] : []),
    ...(showRoadNet.value && !is3d.value ? ['roadnet'] : []),
  ];
  props.api.setLayers(activeLayers);

  const features = ['bg', 'building'];
  if (isTraffic.value) {
    features.push('road');
  } else if (showRoad.value) {
    features.push('road');
  }
  if (!showRoadNet.value && showPoi.value) {
    features.push('point');
  }
  props.api.setFeatures(features);
}

// 新增：处理主题切换
function updateTheme() {
  const map = props.api.getMapInstance();
  if (!map || isSatellite.value) return; // 卫星图模式下不覆盖样式

  const styleMap = {
    dark: 'amap://styles/dark',
    light: 'amap://styles/whitesmoke',
    normal: 'amap://styles/normal',
  };
  map.setMapStyle(styleMap[mapTheme.value]);
}

// 监听所有变化
watch(
  [isSatellite, isTraffic, showPoi, showRoad, showRoadNet],
  () => updateLayers(),
  {
    immediate: true,
  },
);

watch([mapTheme, isSatellite], () => updateTheme());
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <!-- 底图设置 -->
    <div class="flex flex-col gap-2">
      <div class="font-medium text-foreground/80">底图与主题</div>

      <div class="flex items-center justify-between">
        <Checkbox v-model:checked="isSatellite">卫星影像</Checkbox>
      </div>

      <!-- 地图主题（在卫星图下禁用） -->
      <div class="flex items-center justify-between mt-1">
        <span class="text-xs text-foreground/60">地图主题：</span>
        <RadioGroup
          v-model:value="mapTheme"
          button-style="solid"
          size="small"
          :disabled="isSatellite"
        >
          <RadioButton value="normal">默认</RadioButton>
          <RadioButton value="dark">暗黑</RadioButton>
          <RadioButton value="light">极简白</RadioButton>
        </RadioGroup>
      </div>
    </div>

    <Divider class="!my-1" />

    <!-- 叠加与控制 -->
    <div class="flex flex-col gap-2">
      <div class="font-medium text-foreground/80">叠加与控制</div>

      <div class="grid grid-cols-2 gap-y-2 gap-x-4">
        <Checkbox
          v-model:checked="showPoi"
          :disabled="showRoadNet || isSatellite"
        >
          地点文字
        </Checkbox>
        <Checkbox v-model:checked="showRoad" :disabled="isSatellite">
          路网骨架
        </Checkbox>
        <Checkbox v-if="!is3d" v-model:checked="showRoadNet">道路注记</Checkbox>
        <Checkbox v-model:checked="isTraffic">实时路况</Checkbox>
      </div>
    </div>
  </div>
</template>
