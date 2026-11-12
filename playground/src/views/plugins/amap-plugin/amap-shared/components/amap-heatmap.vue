<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button, Slider } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const showHeatmap = ref(false);
const radius = ref(30);
let heatmap: any = null;

function generateData() {
  const data = [];
  for (let i = 0; i < 200; i++) {
    data.push({
      lng: 116.397 + (Math.random() - 0.5) * 0.1,
      lat: 39.892 + (Math.random() - 0.5) * 0.1,
      count: Math.floor(Math.random() * 100),
    });
  }
  return data;
}

function toggleHeatmap() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;

  if (showHeatmap.value) {
    heatmap?.hide();
    showHeatmap.value = false;
    return;
  }

  if (heatmap) {
    heatmap.show();
    showHeatmap.value = true;
  } else {
    map.plugin(['AMap.HeatMap'], () => {
      heatmap = new AMap.HeatMap(map, {
        radius: radius.value,
        opacity: [0, 0.8],
        gradient: { 0.5: 'blue', 0.65: 'lime', 0.7: 'yellow', 0.9: 'red' },
      });
      heatmap.setDataSet({ data: generateData(), max: 100 });
      showHeatmap.value = true;
    });
  }
}

function updateRadius(v: number) {
  radius.value = v;
  if (heatmap && showHeatmap.value) {
    heatmap.setOptions({ radius: v });
  }
}

onBeforeUnmount(() => {
  heatmap?.hide();
  heatmap = null;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-3">
      <Button
        :type="showHeatmap ? 'primary' : 'default'"
        size="small"
        @click="toggleHeatmap"
      >
        {{ showHeatmap ? '隐藏热力图' : '生成热力图' }}
      </Button>
    </div>
    <div v-if="showHeatmap" class="flex items-center gap-2">
      <span class="text-xs text-foreground/60">半径:</span>
      <Slider
        :value="radius"
        :min="10"
        :max="100"
        class="flex-1"
        @change="updateRadius"
      />
    </div>
  </div>
</template>
