<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button, Tag } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const measuring = ref(false);
let rangingTool: any = null;

function toggleMeasure() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;

  if (measuring.value) {
    rangingTool?.clear();
    rangingTool?.close();
    rangingTool = null;
    measuring.value = false;
    return;
  }

  AMap.plugin(['AMap.RangingTool'], () => {
    rangingTool = new AMap.RangingTool(map);
    rangingTool.on('end', () => {
      rangingTool.turnOff();
      measuring.value = false;
    });
    rangingTool.turnOn();
    measuring.value = true;
  });
}

onBeforeUnmount(() => {
  rangingTool?.clear();
  rangingTool?.close();
});
</script>

<template>
  <div class="flex items-center gap-3">
    <Button
      :type="measuring ? 'primary' : 'default'"
      size="small"
      @click="toggleMeasure"
    >
      {{ measuring ? '结束测距' : '开启测距' }}
    </Button>
    <Tag v-if="measuring" color="processing" class="!m-0">
      请在地图上连续点击
    </Tag>
  </div>
</template>
