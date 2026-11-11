<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { ref } from 'vue';

import { Button, Space, Tooltip } from 'antdv-next';

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
</script>

<template>
  <Space wrap>
    <Tooltip title="放大一级">
      <Button @click="zoomIn">放大</Button>
    </Tooltip>
    <Tooltip title="缩小一级">
      <Button @click="zoomOut">缩小</Button>
    </Tooltip>
    <Tooltip title="回到默认中心">
      <Button @click="resetCenter">复位</Button>
    </Tooltip>
    <Tooltip title="定位到当前位置">
      <Button type="primary" :loading="locating" @click="locate">
        {{ locating ? '定位中' : '定位' }}
      </Button>
    </Tooltip>
  </Space>
</template>
