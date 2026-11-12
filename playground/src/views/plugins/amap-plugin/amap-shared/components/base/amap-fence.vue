<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button, message } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const drawing = ref(false);
let fencePolygon: any = null;
let mouseTool: any = null;

// 🔥 新增：保存测试点的 Marker 实例，方便清理
let testMarker: any = null;

function drawFence() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;

  drawing.value = true;

  // 清理上一次的围栏和测试点
  if (fencePolygon) {
    map.remove(fencePolygon);
    fencePolygon = null;
  }
  if (testMarker) {
    map.remove(testMarker);
    testMarker = null;
  }

  if (!mouseTool) {
    mouseTool = new AMap.MouseTool(map);
    mouseTool.on('draw', (e: any) => {
      mouseTool.close(false);
      drawing.value = false;
      fencePolygon = e.obj;

      // 随机生成一个点测试是否在围栏内
      const testPoint = [
        116.397 + (Math.random() - 0.5) * 0.1,
        39.892 + (Math.random() - 0.5) * 0.1,
      ];
      const isInside = AMap.GeometryUtil.isPointInRing(
        new AMap.LngLat(testPoint[0], testPoint[1]),
        fencePolygon.getPath(),
      );

      // 🔥 修复 no-new 报错：将实例赋值给变量
      testMarker = new AMap.Marker({
        map,
        position: testPoint,
        icon: isInside
          ? 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png'
          : 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
      });

      message.info(
        isInside ? '测试点在围栏内（红点）' : '测试点在围栏外（蓝点）',
      );
    });
  }
  mouseTool.polygon({
    strokeColor: '#3b82f6',
    fillColor: 'rgba(59, 130, 246, 0.2)',
  });
}

onBeforeUnmount(() => {
  mouseTool?.close(false);
  // 组件卸载时清理
  if (testMarker) {
    testMarker.setMap(null);
    testMarker = null;
  }
});
</script>

<template>
  <div class="flex items-center gap-3">
    <Button
      :type="drawing ? 'primary' : 'default'"
      size="small"
      @click="drawFence"
    >
      {{ drawing ? '绘制中...' : '绘制电子围栏' }}
    </Button>
  </div>
</template>
