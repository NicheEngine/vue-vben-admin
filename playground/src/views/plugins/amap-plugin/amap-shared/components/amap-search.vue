<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { ref } from 'vue';

import { Alert, Button, Empty, Input, SpaceCompact } from 'antdv-next';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const keyword = ref('');
const results = ref<any[]>([]);
const loading = ref(false);
const searched = ref(false);
const errorMsg = ref('');
const pageIndex = ref(1);
const PAGE_SIZE = 10;

async function handleSearch(page = 1) {
  const kw = keyword.value.trim();
  if (!kw) return;

  loading.value = true;
  errorMsg.value = '';
  if (page === 1) results.value = [];
  pageIndex.value = page;

  try {
    const list = await props.api.searchPOI(kw, {
      pageIndex: page,
      pageSize: PAGE_SIZE,
    });
    results.value = page === 1 ? list : [...results.value, ...list];
    searched.value = true;
  } catch (error: any) {
    errorMsg.value = error?.message || '搜索失败';
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  void handleSearch(pageIndex.value + 1);
}

function selectPlace(poi: any) {
  const pos: [number, number] = [poi.location.lng, poi.location.lat];
  props.api.setCenter(pos);
  props.api.setZoom(17);
  props.api.addMarker(pos);
}

function clear() {
  keyword.value = '';
  results.value = [];
  searched.value = false;
  errorMsg.value = '';
  pageIndex.value = 1;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <SpaceCompact class="w-full">
      <Input
        v-model:value="keyword"
        placeholder="搜索地点..."
        allow-clear
        @press-enter="handleSearch(1)"
      />
      <Button type="primary" :loading="loading" @click="handleSearch(1)">
        {{ loading ? '搜索中' : '搜索' }}
      </Button>
      <Button v-if="searched" @click="clear">清空</Button>
    </SpaceCompact>

    <Alert
      v-if="errorMsg"
      type="error"
      :message="errorMsg"
      show-icon
      class="!py-1"
    />

    <template v-else-if="results.length > 0">
      <!-- 用 div 模拟 List -->
      <div
        class="max-h-60 overflow-y-auto rounded border border-border bg-card text-sm"
      >
        <div
          v-for="poi in results"
          :key="poi.id"
          class="cursor-pointer border-b border-border px-3 py-2 transition-colors last:border-0 hover:bg-accent/50"
          @click="selectPlace(poi)"
        >
          <div class="font-medium text-foreground">{{ poi.name }}</div>
          <div class="text-xs text-muted-foreground">{{ poi.address }}</div>
        </div>
      </div>

      <Button size="small" block :loading="loading" @click="loadMore">
        加载更多
      </Button>
    </template>

    <Empty
      v-else-if="searched && !loading && !errorMsg"
      :image="Empty.PRESENTED_IMAGE_SIMPLE"
      description="未找到相关地点"
      class="!my-2"
    />
  </div>
</template>
