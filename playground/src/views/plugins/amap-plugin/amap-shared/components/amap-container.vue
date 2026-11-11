<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { Button, Result, Spin } from 'antdv-next';

defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <div class="amap-container relative h-full w-full">
    <slot></slot>

    <!-- 加载中 -->
    <div
      v-if="api.isLoading.value"
      class="absolute inset-0 z-10 flex items-center justify-center bg-black/50"
    >
      <Spin size="large" tip="加载地图中...">
        <div class="h-20 w-20"></div>
      </Spin>
    </div>

    <!-- 错误态 -->
    <div
      v-else-if="api.error.value"
      class="absolute inset-0 z-10 flex items-center justify-center bg-black/75"
    >
      <Result
        status="error"
        title="地图加载失败"
        :sub-title="api.error.value"
        class="max-w-md"
      >
        <template #extra>
          <Button type="primary" @click="emit('retry')">重试</Button>
        </template>
      </Result>
    </div>
  </div>
</template>
