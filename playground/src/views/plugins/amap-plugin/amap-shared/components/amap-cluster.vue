<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const showCluster = ref(false);
let cluster: any = null;

function toggleCluster() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;

  // ================== 清空逻辑 ==================
  if (showCluster.value) {
    if (cluster) {
      cluster.setMap(null); // 2. 从地图上卸载聚合层
      cluster = null; // 3. 彻底销毁引用
    }
    showCluster.value = false;
    return;
  }

  // ================== 添加逻辑 ==================
  const points: { lnglat: [number, number] }[] = [];
  for (let i = 0; i < 500; i++) {
    points.push({
      lnglat: [
        116.397 + (Math.random() - 0.5) * 0.2,
        39.892 + (Math.random() - 0.5) * 0.2,
      ],
    });
  }

  map.plugin(['AMap.MarkerCluster'], () => {
    cluster = new AMap.MarkerCluster(map, points, {
      gridSize: 60,
      renderClusterMarker: (context: any) => {
        const count = context.count;
        const div = document.createElement('div');
        div.className =
          'flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md border-2 border-white';
        div.style.width = `${Math.min(60, 30 + count / 10)}px`;
        div.style.height = `${Math.min(60, 30 + count / 10)}px`;
        div.innerHTML = `<span class="text-xs font-bold">${count}</span>`;
        context.marker.setContent(div);
        context.marker.setOffset(new AMap.Pixel(-15, -15));
      },
    });
    showCluster.value = true;
  });
}

onBeforeUnmount(() => {
  if (cluster) {
    cluster.setMap(null);
    cluster = null;
  }
});
</script>

<template>
  <div class="flex items-center gap-3">
    <Button
      :type="showCluster ? 'primary' : 'default'"
      size="small"
      @click="toggleCluster"
    >
      {{ showCluster ? '清空 500 个点' : '添加 500 个聚合点' }}
    </Button>
  </div>
</template>
