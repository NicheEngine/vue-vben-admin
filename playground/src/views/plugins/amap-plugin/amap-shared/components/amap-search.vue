<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  SpaceCompact,
} from 'antdv-next';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
  center?: [number, number];
}>();

const keyword = ref('');
const results = ref<any[]>([]);
const loading = ref(false);
const searched = ref(false);
const errorMsg = ref('');
const pageIndex = ref(1);
const PAGE_SIZE = 10;

const searchMode = ref<'keyword' | 'nearby'>('keyword');
const radius = ref(1000);

let autoComplete: any = null;

watch(
  () => props.api.isReady.value,
  (ready) => {
    if (ready && !autoComplete) {
      const AMap = props.api.getAMap();
      if (AMap) {
        AMap.plugin('AMap.AutoComplete', () => {
          autoComplete = new AMap.AutoComplete({ city: '全国' });
        });
      }
    }
  },
  { immediate: true },
);

watch(keyword, (val) => {
  if (!val || !autoComplete) return;
  autoComplete.search(val, (status: string, result: any) => {
    if (status === 'complete') {
      console.warn('[AutoComplete 联想]', result.tips?.slice(0, 5));
    }
  });
});

// ==================== 提取出来的周边搜索 Promise 逻辑 ====================
function searchNearbyPromise(
  AMap: any,
  kw: string,
  center: [number, number],
  radiusVal: number,
  page: number,
) {
  return new Promise<any[]>((resolve, reject) => {
    AMap.plugin('AMap.PlaceSearch', () => {
      const ps = new AMap.PlaceSearch({ pageSize: PAGE_SIZE, pageIndex: page });

      // 独立的状态处理回调
      const onSearchComplete = (status: string, result: any) => {
        if (status === 'complete') {
          resolve(result.poiList?.pois || []);
          return;
        }
        if (status === 'no_data') {
          resolve([]);
          return;
        }
        reject(new Error('周边搜索失败'));
      };

      ps.searchNearBy(kw, center, radiusVal, onSearchComplete);
    });
  });
}

// ==================== 主搜索逻辑 ====================
async function handleSearch(page = 1) {
  const kw = keyword.value.trim();
  if (!kw) return;

  loading.value = true;
  errorMsg.value = '';
  if (page === 1) results.value = [];
  pageIndex.value = page;

  try {
    let list: any[] = [];
    if (searchMode.value === 'nearby' && props.center) {
      const AMap = props.api.getAMap();
      list = await searchNearbyPromise(
        AMap,
        kw,
        props.center,
        radius.value,
        page,
      );
    } else {
      list = await props.api.searchPOI(kw, {
        pageIndex: page,
        pageSize: PAGE_SIZE,
      });
    }
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
    <!-- 第一行：模式切换 -->
    <div class="flex flex-wrap gap-2 text-xs">
      <Button
        size="small"
        :type="searchMode === 'keyword' ? 'primary' : 'default'"
        @click="searchMode = 'keyword'"
      >
        关键字
      </Button>
      <Button
        size="small"
        :type="searchMode === 'nearby' ? 'primary' : 'default'"
        @click="searchMode = 'nearby'"
      >
        周边
      </Button>
      <div v-if="searchMode === 'nearby'" class="ml-2 flex items-center gap-1">
        <span class="text-foreground/50">半径</span>
        <InputNumber
          v-model:value="radius"
          size="small"
          :min="100"
          :max="5000"
          :step="100"
          class="w-16"
        />
        <span class="text-foreground/50">米</span>
      </div>
    </div>

    <!-- 第二行：搜索框 -->
    <SpaceCompact class="w-full">
      <Input
        v-model:value="keyword"
        placeholder="搜索地点..."
        allow-clear
        class="h-8"
        @press-enter="handleSearch(1)"
      />
      <Button
        type="primary"
        class="h-8 px-4"
        :loading="loading"
        @click="handleSearch(1)"
      >
        {{ loading ? '搜索中' : '搜索' }}
      </Button>
      <Button v-if="searched" class="h-8" @click="clear"> 清空 </Button>
    </SpaceCompact>

    <Alert
      v-if="errorMsg"
      type="error"
      :message="errorMsg"
      show-icon
      class="!py-1 text-sm"
    />

    <template v-else-if="results.length > 0">
      <div
        class="max-h-[200px] overflow-y-auto rounded border border-border bg-card text-sm"
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
