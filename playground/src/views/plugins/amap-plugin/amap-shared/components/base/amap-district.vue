<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button, Input, message, SpaceCompact } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const keyword = ref('朝阳区');
const loading = ref(false);
const searched = ref(false); // 是否已经搜索过
let polygons: any[] = [];

function clearDistrict() {
  const map = props.api.getMapInstance();
  if (map && polygons.length > 0) {
    map.remove(polygons);
    polygons = [];
  }
  // 清空时隐藏清除按钮
  searched.value = false;
}

function searchDistrict() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map || !keyword.value) return;

  loading.value = true;
  clearDistrict();

  AMap.plugin('AMap.DistrictSearch', () => {
    const districtSearch = new AMap.DistrictSearch({
      level: 'district',
      subdistrict: 0,
      extensions: 'all',
    });

    districtSearch.search(keyword.value, (status: string, result: any) => {
      loading.value = false;
      if (status === 'complete' && result.districtList?.length) {
        const district = result.districtList[0];
        const bounds = district.boundaries;
        if (bounds) {
          bounds.forEach((path: any) => {
            const polygon = new AMap.Polygon({
              map,
              path,
              strokeColor: '#3b82f6',
              strokeWeight: 2,
              fillColor: 'rgba(59, 130, 246, 0.2)',
              fillOpacity: 0.3,
            });
            polygons.push(polygon);
          });
          map.setFitView(polygons);
          message.success(`已绘制：${district.name}`);
        }
      } else {
        message.warning('未找到该行政区');
      }
      // 搜索结束后，标记为已搜索，显示清除按钮
      searched.value = true;
    });
  });
}

onBeforeUnmount(clearDistrict);
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 参考 AmapSearch 的紧凑型搜索栏 -->
    <SpaceCompact class="w-full">
      <Input
        v-model:value="keyword"
        placeholder="如：朝阳区"
        allow-clear
        class="h-8"
        @press-enter="searchDistrict"
      />
      <Button
        type="primary"
        class="h-8 px-4"
        :loading="loading"
        @click="searchDistrict"
      >
        {{ loading ? '查询中' : '查询' }}
      </Button>
      <Button v-if="searched" class="h-8" @click="clearDistrict">
        清除边界
      </Button>
    </SpaceCompact>
  </div>
</template>
