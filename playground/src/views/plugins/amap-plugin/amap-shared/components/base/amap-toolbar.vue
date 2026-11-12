<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const emit = defineEmits<{ locate: [coord: [number, number]] }>();

const locating = ref(false);
let scaleControl: any = null;
let hawkEyeControl: any = null;
const showScale = ref(false);
const showHawkEye = ref(false);

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
  if (locating.value) return;
  locating.value = true;
  try {
    const coord = await props.api.triggerGeolocation();
    emit('locate', coord);
  } catch (error) {
    console.warn('[AmapToolbar] 定位失败', error);
  } finally {
    locating.value = false;
  }
}

function toggleScale() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;
  if (showScale.value) {
    if (scaleControl) {
      map.removeControl(scaleControl);
      scaleControl = null;
    }
    showScale.value = false;
  } else {
    AMap.plugin('AMap.Scale', () => {
      scaleControl = new AMap.Scale();
      map.addControl(scaleControl);
      showScale.value = true;
    });
  }
}

function toggleHawkEye() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;
  if (showHawkEye.value) {
    if (hawkEyeControl) {
      map.removeControl(hawkEyeControl);
      hawkEyeControl = null;
    }
    showHawkEye.value = false;
  } else {
    AMap.plugin('AMap.HawkEye', () => {
      hawkEyeControl = new AMap.HawkEye({ isOpen: true });
      map.addControl(hawkEyeControl);
      showHawkEye.value = true;
    });
  }
}

onBeforeUnmount(() => {
  const map = props.api.getMapInstance();
  if (map) {
    if (scaleControl) map.removeControl(scaleControl);
    if (hawkEyeControl) map.removeControl(hawkEyeControl);
  }
});
</script>

<template>
  <div class="flex flex-col">
    <!-- 顶部操作区 -->
    <div class="flex flex-wrap gap-2">
      <Button size="small" @click="zoomIn">放大</Button>
      <Button size="small" @click="zoomOut">缩小</Button>
      <Button size="small" @click="resetCenter">复位</Button>
      <Button
        size="small"
        :type="showScale ? 'primary' : 'default'"
        @click="toggleScale"
      >
        比例尺
      </Button>
      <Button
        size="small"
        :type="showHawkEye ? 'primary' : 'default'"
        @click="toggleHawkEye"
      >
        鹰眼
      </Button>
    </div>

    <!-- 统一的分割线 -->
    <div class="my-3 h-px w-full bg-border/50"></div>

    <!-- 底部状态与操作区 -->
    <div class="flex h-7 items-center justify-between">
      <span class="text-xs text-foreground/40">地图控制</span>
      <Button type="primary" size="small" :disabled="locating" @click="locate">
        {{ locating ? '定位中...' : '定位' }}
      </Button>
    </div>
  </div>
</template>
