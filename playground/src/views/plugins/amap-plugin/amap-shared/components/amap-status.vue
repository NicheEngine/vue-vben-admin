<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { computed } from 'vue';

import { Descriptions } from 'antdv-next';

import { formatAddress, formatPoint } from '../utils';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const is3d = computed(() => props.api.kind === '3d');
const api3d = computed(() => (is3d.value ? (props.api as IAmap3dApi) : null));

const items = computed(() => {
  const base = [
    { label: '中心点', children: formatPoint(props.api.center.value) },
    { label: '缩放', children: String(props.api.zoom.value) },
    {
      label: '鼠标',
      children: formatPoint(props.api.mousePosition.value),
    },
    {
      label: '中心地址',
      children: formatAddress(props.api.currentAddress.value),
    },
    { label: '覆盖物数量', children: String(props.api.overlays.value.length) },
  ];
  if (api3d.value) {
    base.push(
      { label: '俯仰角', children: `${api3d.value.pitch.value}°` },
      { label: '旋转角', children: `${api3d.value.rotation.value}°` },
    );
  }
  return base;
});
</script>

<template>
  <Descriptions :column="1" size="small" bordered :items="items" />
</template>
