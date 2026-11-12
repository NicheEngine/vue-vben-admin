<script lang="ts" setup>
import type { Point } from '@vben/amap'; // 移除 OverlayRecord

import { computed, onBeforeUnmount, reactive, ref } from 'vue';

import { Amap2d, useAmap2d } from '@vben/amap';
import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Collapse,
  CollapsePanel,
  InputNumber,
  message,
  RadioButton,
  RadioGroup,
  Tag,
} from 'antdv-next';

import {
  AmapCluster,
  AmapContainer,
  AmapDistrict,
  AmapDraw,
  AmapFence,
  AmapHeatmap,
  AmapLayer,
  AmapMeasure,
  AmapPath,
  AmapSearch,
  AmapStatus,
  AmapToolbar,
  AmapWeather,
} from '../amap-shared';

defineOptions({ name: 'Amap2dPluginExample' });

const [, api, config] = useAmap2d({
  config: { center: [116.397, 39.892], zoom: 12 },
});

const isReady = computed(() => api.isReady.value);

// ================= 坐标渲染逻辑 =================
const testCoord = reactive<{ lng: number; lat: number }>({
  lng: 116.397,
  lat: 39.892,
});

function randomCoord() {
  testCoord.lng = 116.2 + Math.random() * 0.4;
  testCoord.lat = 39.7 + Math.random() * 0.4;
}

const isWGS84 = computed({
  get: () => api.coordinateSystem.value === 'WGS84',
  set: (val) => {
    api.setCoordinateSystem(val ? 'WGS84' : 'GCJ02');
  },
});

const pointMarker = ref<any>(null);
async function renderCoordOnMap() {
  if (!isReady.value) return;

  try {
    let targetPoint: Point = [testCoord.lng, testCoord.lat];

    if (api.coordinateSystem.value === 'WGS84') {
      const converted = await api.convertFromGPS([targetPoint]);
      const firstPoint = converted[0];
      if (!firstPoint) {
        throw new Error('坐标转换结果为空');
      }
      targetPoint = firstPoint;
    }

    if (pointMarker.value) {
      api.removeOverlay(pointMarker.value);
    }

    api.setCenter(targetPoint);
    api.setZoom(16);
    pointMarker.value = api.addMarker(targetPoint, {
      animation: 'AMAP_ANIMATION_DROP',
    });

    message.success(`已渲染坐标 (${api.coordinateSystem.value})`);
  } catch (error: any) {
    message.error(error.message || '坐标渲染失败');
  }
}

// ================= 原有逻辑 =================
const currentLocationMarker = ref<any>(null);
function clearLocationMarker() {
  if (currentLocationMarker.value) {
    api.removeOverlay(currentLocationMarker.value);
    currentLocationMarker.value = null;
  }
}
function setLocationMarker(coord: [number, number], zoom = 12) {
  clearLocationMarker();
  api.setCenter(coord);
  api.setZoom(zoom);
  currentLocationMarker.value = api.addMarker(coord, {
    animation: 'AMAP_ANIMATION_DROP',
  });
}
function goCity(coord: [number, number], zoom = 12) {
  setLocationMarker(coord, zoom);
}
function handleLocate(coord: [number, number]) {
  setLocationMarker(coord, 16);
}

onBeforeUnmount(() => clearLocationMarker());
</script>

<template>
  <Page title="高德地图 2D 插件">
    <!-- 使用说明 -->
    <Collapse class="mb-4">
      <CollapsePanel header="使用说明" key="1">
        <div class="space-y-2 text-sm text-foreground/70">
          <p>
            <b>图层</b>：支持电子地图与卫星影像互斥切换，可叠加文字、路网、实时路况、主题切换。
          </p>
          <p>
            <b>绘制</b>：支持点标记、圆、多边形、折线，绘制后自动进入编辑，可在列表中点击切换编辑并导出
            GeoJSON。
          </p>
          <p>
            <b>搜索</b>：输入关键字搜索
            POI，或点击快速跳转，点击结果可定位并自动打点。
          </p>
        </div>
      </CollapsePanel>
    </Collapse>

    <!-- 地图状态与坐标系测试 -->
    <Card class="mb-4" size="small">
      <template #title>地图状态</template>
      <template #extra>
        <div class="flex items-center gap-1.5 text-xs text-foreground/70">
          <span
            class="h-2 w-2 rounded-full"
            :class="isReady ? 'bg-green-500' : 'bg-orange-500 animate-pulse'"
          ></span>
          {{ isReady ? '已就绪' : '加载中' }}
        </div>
      </template>

      <div class="flex flex-col gap-4 py-1">
        <!-- 第一行：坐标系基准与切换 -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-foreground/70">底图基准：</span>
            <Tag color="blue" class="!m-0 !px-2 !text-xs leading-5">GCJ-02</Tag>
            <span class="text-xs text-foreground/40">(高德底图强制)</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-sm text-foreground/70">输入坐标系：</span>
            <RadioGroup
              v-model:value="isWGS84"
              button-style="solid"
              size="small"
            >
              <RadioButton :value="false">GCJ-02</RadioButton>
              <RadioButton :value="true">WGS84</RadioButton>
            </RadioGroup>
          </div>
        </div>

        <div class="h-px w-full bg-border/50"></div>

        <!-- 第二行：输入与渲染 -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-foreground/70">测试坐标：</span>
            <InputNumber
              v-model:value="testCoord.lng"
              size="small"
              :precision="6"
              placeholder="经度"
              class="w-[120px]"
            />
            <span class="text-foreground/30">,</span>
            <InputNumber
              v-model:value="testCoord.lat"
              size="small"
              :precision="6"
              placeholder="纬度"
              class="w-[120px]"
            />
          </div>

          <Button size="small" @click="randomCoord">随机</Button>
          <Button
            type="primary"
            size="small"
            class="ml-auto"
            @click="renderCoordOnMap"
          >
            渲染到地图
          </Button>
        </div>
      </div>
    </Card>

    <!-- 核心布局：固定高度，左侧独立滚动 -->
    <div class="flex h-[800px] w-full items-stretch gap-4">
      <!-- 左侧面板 -->
      <div class="flex h-full w-[340px] shrink-0 flex-col overflow-hidden">
        <div class="flex flex-1 flex-col gap-4 overflow-y-auto pb-2 pr-1">
          <!-- 地点搜索 -->
          <Card title="地点搜索" size="small">
            <AmapSearch :api="api" :center="api.center.value" />
            <div
              class="mt-3 flex items-center gap-3 border-t border-border pt-3"
            >
              <span class="shrink-0 text-xs leading-none text-foreground/60">快速跳转：</span>
              <div class="flex flex-wrap gap-2">
                <Button size="small" @click="goCity([116.397, 39.892])">
                  北京
                </Button>
                <Button size="small" @click="goCity([121.473, 31.23])">
                  上海
                </Button>
                <Button size="small" @click="goCity([113.264, 23.129])">
                  广州
                </Button>
              </div>
            </div>
          </Card>

          <!-- 地图工具 -->
          <Card title="地图工具" size="small">
            <AmapToolbar :api="api" @locate="handleLocate" />
          </Card>

          <!-- 🔥 绘制与编辑工具（自带覆盖物列表） -->
          <Card title="绘制与编辑" size="small" class="relative">
            <AmapDraw :api="api" />
          </Card>

          <!-- 图层控制 -->
          <Card title="图层控制" size="small">
            <AmapLayer :api="api" />
          </Card>

          <!-- 高级交互 -->
          <Card title="高级交互" size="small">
            <div class="flex flex-wrap items-center gap-2">
              <AmapMeasure :api="api" />
              <AmapFence :api="api" />
            </div>
          </Card>

          <!-- 数据可视化 -->
          <Card title="数据可视化" size="small">
            <div class="flex flex-wrap items-center gap-2">
              <AmapHeatmap :api="api" />
              <AmapCluster :api="api" />
            </div>
          </Card>

          <!-- 路线巡航 -->
          <Card title="路线巡航" size="small">
            <AmapPath :api="api" />
          </Card>

          <!-- 服务查询 -->
          <Card title="服务查询" size="small">
            <div class="flex flex-col gap-4">
              <div>
                <div class="mb-2 text-xs text-foreground/60">行政区划：</div>
                <AmapDistrict :api="api" />
              </div>
              <div>
                <div class="mb-2 text-xs text-foreground/60">天气查询：</div>
                <AmapWeather :api="api" />
              </div>
            </div>
          </Card>

          <!-- 实时状态 -->
          <Card title="实时状态" size="small">
            <AmapStatus :api="api" />
          </Card>
        </div>
      </div>

      <!-- 右侧地图区域 -->
      <Card
        class="flex-1 overflow-hidden"
        :styles="{ body: { padding: 0, height: '100%' } }"
      >
        <AmapContainer class="h-full w-full" :api="api">
          <Amap2d class="h-full w-full" :api="api" :config="config" />
        </AmapContainer>
      </Card>
    </div>
  </Page>
</template>
