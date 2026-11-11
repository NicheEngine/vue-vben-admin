<script lang="ts" setup>
import type { OverlayRecord } from '@vben/amap';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Amap3d, useAmap3d } from '@vben/amap';
import { Page } from '@vben/common-ui';

import { Button, Card, Collapse, Slider, Tag } from 'antdv-next';

import {
  AmapContainer,
  AmapLayer,
  AmapSearch,
  AmapStatus,
  AmapToolbar,
} from '../amap-shared';

defineOptions({ name: 'Amap3dPluginExample' });

const [, api, config] = useAmap3d({
  config: {
    center: [103.8, 31.1],
    zoom: 12,
    pitch: 60,
    rotation: 0,
    terrain: true,
  },
});

const isReady = computed(() => api.isReady.value);

// 🔥 3D 专属：pitch / rotation 双向绑定
const pitch = ref(60);
const rotation = ref(0);

watch(pitch, (v) => api.setPitch(v));
watch(rotation, (v) => api.setRotation(v));
// 地图拖动后同步回滑块（可选）
watch(
  () => api.pitch.value,
  (v) => {
    if (Math.abs(v - pitch.value) > 0.5) pitch.value = v;
  },
);
watch(
  () => api.rotation.value,
  (v) => {
    if (Math.abs(v - rotation.value) > 0.5) rotation.value = v;
  },
);

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

function removeOverlay(record: OverlayRecord) {
  api.removeOverlayById(record.id);
}
function clearOverlays() {
  clearLocationMarker();
  api.clearOverlays();
}
onBeforeUnmount(() => clearLocationMarker());

const collapseItems = [
  {
    key: '1',
    label: '使用说明',
    children: `
      <div class="space-y-2 text-sm text-foreground/70">
        <p><b>地形</b>：已开启真实地形起伏，适合查看川西等山区。</p>
        <p><b>视角</b>：右侧滑块可调整俯仰角与旋转角，也可直接拖动地图。</p>
        <p><b>图层</b>：支持电子地图 / 卫星影像切换，支持实时路况。</p>
      </div>
    `,
  },
];
</script>

<template>
  <Page title="高德地图 3D 插件">
    <template #description>
      <div class="mt-2 text-foreground/80">
        3D 地图完整示例：真实地形、俯仰/旋转控制、图层、搜索、定位。
      </div>
    </template>

    <Collapse class="mb-4" :items="collapseItems" />

    <Card class="mb-4" title="地图控制">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm">状态：</span>
          <Tag :color="isReady ? 'green' : 'orange'">
            {{ isReady ? '已就绪' : '加载中' }}
          </Tag>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm">快速跳转：</span>
          <Button size="small" @click="goCity([103.8, 31.1])">川西</Button>
          <Button size="small" @click="goCity([116.397, 39.892])">北京</Button>
          <Button size="small" @click="goCity([121.473, 31.23])">上海</Button>
        </div>
      </div>
    </Card>

    <div class="flex h-[800px] w-full items-stretch gap-4">
      <Card
        class="flex-1 overflow-hidden"
        :styles="{ body: { padding: 0, height: '100%' } }"
      >
        <AmapContainer class="h-full w-full" :api="api">
          <Amap3d class="h-full w-full" :api="api" :config="config" />
        </AmapContainer>
      </Card>

      <div class="flex w-[340px] shrink-0 flex-col gap-4">
        <div class="shrink-0 space-y-4">
          <!-- 🔥 3D 专属：视角控制 -->
          <Card title="视角控制" size="small">
            <div class="space-y-3">
              <div>
                <div class="mb-1 flex items-center justify-between text-xs">
                  <span>俯仰角</span>
                  <span class="text-foreground/60">{{ pitch }}°</span>
                </div>
                <Slider v-model:value="pitch" :min="0" :max="83" :step="1" />
              </div>
              <div>
                <div class="mb-1 flex items-center justify-between text-xs">
                  <span>旋转角</span>
                  <span class="text-foreground/60">{{ rotation }}°</span>
                </div>
                <Slider
                  v-model:value="rotation"
                  :min="0"
                  :max="360"
                  :step="1"
                />
              </div>
            </div>
          </Card>

          <Card title="地点搜索" size="small">
            <AmapSearch :api="api" />
          </Card>
          <Card title="图层控制" size="small">
            <AmapLayer :api="api" />
          </Card>
          <Card title="地图工具" size="small">
            <AmapToolbar :api="api" @locate="handleLocate" />
          </Card>
          <Card title="实时状态" size="small">
            <AmapStatus :api="api" />
          </Card>
        </div>

        <Card
          title="覆盖物"
          size="small"
          class="flex flex-1 flex-col overflow-hidden"
          :styles="{
            body: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '12px',
            },
          }"
        >
          <div
            v-if="api.overlays.value.length === 0"
            class="mt-2 text-xs text-foreground/50"
          >
            暂无覆盖物
          </div>
          <div v-else class="flex h-full flex-col overflow-hidden">
            <div class="flex-1 space-y-1 overflow-y-auto pr-1">
              <div
                v-for="record in api.overlays.value"
                :key="record.id"
                class="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
              >
                <span class="truncate">
                  {{ record.type }} · {{ record.id }}
                </span>
                <Button
                  size="small"
                  type="text"
                  danger
                  @click="removeOverlay(record)"
                >
                  删除
                </Button>
              </div>
            </div>
            <div class="mt-auto shrink-0 pt-2">
              <Button size="small" danger block @click="clearOverlays">
                清除全部
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>
