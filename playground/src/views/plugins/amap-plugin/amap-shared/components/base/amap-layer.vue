<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { computed, ref, watch } from 'vue';

import { usePreferences } from '@vben/preferences';

import { Checkbox, Divider, RadioButton, RadioGroup } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const is3d = computed(() => props.api.kind === '3d');

const { isDark } = usePreferences();

const isSatellite = ref(false);
const isTraffic = ref(false);
const showPoi = ref(true);
const showRoad = ref(true);
const showRoadNet = ref(false);

const mapTheme = ref<'dark' | 'light' | 'normal'>('normal');

// 1. 监听系统 Dark 模式变化，同步 UI
watch(
  isDark,
  (dark) => {
    mapTheme.value = dark ? 'dark' : 'normal';
  },
  { immediate: true },
);

// 2. 核心：监听地图就绪状态，只要一就绪，立刻同步主题
watch(
  () => props.api.isReady.value,
  (ready) => {
    if (ready) {
      handleManualThemeChange(mapTheme.value);
    }
  },
  { immediate: true },
);

function updateLayers() {
  if (!props.api || !props.api.isReady.value) return;

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

function handleManualThemeChange(val: 'dark' | 'light' | 'normal') {
  const map = props.api.getMapInstance();
  // 🔥 必须确保地图已初始化完成
  if (!map || !props.api.isReady.value) return;

  const styleMap: Record<'dark' | 'light' | 'normal', string> = {
    dark: 'amap://styles/dark',
    light: 'amap://styles/whitesmoke',
    normal: 'amap://styles/normal',
  };
  map.setMapStyle(styleMap[val]);

  // 🔥 关键保险：如果是暗黑模式，强制重绘一次要素，防止被之前的白色底图残留覆盖
  if (val === 'dark') {
    setTimeout(() => {
      props.api.setFeatures(['bg', 'building', 'road', 'point']);
    }, 50);
  }
}

// 监听用户手动点击
watch(mapTheme, (newVal) => {
  handleManualThemeChange(newVal);
});

// 监听图层变化
watch(
  [isSatellite, isTraffic, showPoi, showRoad, showRoadNet],
  () => updateLayers(),
  {
    immediate: true,
  },
);
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <!-- 底图设置 -->
    <div class="flex flex-col gap-2">
      <div class="font-medium text-foreground/80">底图与主题</div>

      <div class="flex items-center justify-between">
        <Checkbox v-model:checked="isSatellite"> 卫星影像 </Checkbox>
      </div>

      <!-- 地图主题 -->
      <div class="mt-1 flex items-center justify-between">
        <span class="text-xs text-foreground/60">地图主题：</span>
        <RadioGroup v-model:value="mapTheme" button-style="solid" size="small">
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

      <div class="grid grid-cols-2 gap-x-4 gap-y-2">
        <Checkbox v-model:checked="showPoi" :disabled="showRoadNet">
          地点文字
        </Checkbox>
        <Checkbox v-model:checked="showRoad"> 路网骨架 </Checkbox>
        <Checkbox v-if="!is3d" v-model:checked="showRoadNet">
          道路注记
        </Checkbox>
        <Checkbox v-model:checked="isTraffic"> 实时路况 </Checkbox>
      </div>
    </div>
  </div>
</template>
