<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi, OverlayType } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button, Divider, Space, Tag } from 'antdv-next';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const drawingMode = ref<'none' | OverlayType>('none');

let offDraw: (() => void) | null = null;

const DRAW_MODES: Array<{ mode: OverlayType; label: string }> = [
  { mode: 'marker', label: '点标记' },
  { mode: 'circle', label: '画圆' },
  { mode: 'polygon', label: '画多边形' },
  { mode: 'polyline', label: '画线' },
];

function startDraw(mode: OverlayType) {
  props.api.startDraw(mode);
  drawingMode.value = mode;
  if (!offDraw) {
    offDraw = props.api.onDraw(() => {
      // 绘制完成后自动退出当前模式（可按需改为连续绘制）
      // cancelDraw();
    });
  }
}

function cancelDraw() {
  props.api.stopDraw();
  drawingMode.value = 'none';
}

function clear() {
  props.api.stopDraw();
  props.api.clearOverlays();
  drawingMode.value = 'none';
}

onBeforeUnmount(() => {
  offDraw?.();
  offDraw = null;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <Space wrap>
      <Button
        v-for="item in DRAW_MODES"
        :key="item.mode"
        :type="drawingMode === item.mode ? 'primary' : 'default'"
        @click="startDraw(item.mode)"
      >
        {{ item.label }}
      </Button>
    </Space>

    <Divider class="!my-1" />

    <Space wrap>
      <Tag v-if="drawingMode !== 'none'" color="processing">
        绘制中：{{ drawingMode }}
      </Tag>
      <Button v-if="drawingMode !== 'none'" @click="cancelDraw">
        取消绘制
      </Button>
      <Button danger @click="clear">清除画面</Button>
    </Space>
  </div>
</template>
