<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { computed, onBeforeUnmount, ref } from 'vue';

import {
  Amap2d,
  Amap3d,
  AmapContainer,
  AmapDraw,
  AmapLayer,
  AmapSearch,
  AmapStatus,
  AmapToolbar,
  useAmap2d,
  useAmap3d,
} from '@vben/amap';
import { Page } from '@vben/common-ui';

import { Button, Card, Collapse, Switch, Tag } from 'antdv-next';

defineOptions({ name: 'AmapPluginExample' });

const mode = ref<'2d' | '3d'>('2d');

// 初始中心点设在川西，方便看 3D 地形
const [, api2d, config2d] = useAmap2d({
  config: { center: [103.8, 31.1], zoom: 12 },
});

const [, api3d, config3d] = useAmap3d({
  config: {
    center: [103.8, 31.1],
    zoom: 12,
    pitch: 60,
    rotation: 0,
    terrain: true, // 🔥 开启地形
  },
});

const currentApi = computed<IAmap2dApi | IAmap3dApi>(() =>
  mode.value === '2d' ? api2d : api3d,
);

function toggleMode() {
  mode.value = mode.value === '2d' ? '3d' : '2d';
}

const isReady = computed(() => currentApi.value.isReady.value);

const currentLocationMarker = ref<any>(null);
function clearLocationMarker() {
  if (currentLocationMarker.value) {
    currentApi.value.removeOverlay(currentLocationMarker.value);
    currentLocationMarker.value = null;
  }
}
function setLocationMarker(coord: [number, number], zoom = 12) {
  clearLocationMarker();
  currentApi.value.setCenter(coord);
  currentApi.value.setZoom(zoom);
  currentLocationMarker.value = currentApi.value.addMarker(coord, {
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

const collapseItems = [
  {
    key: '1',
    label: '使用说明',
    children: `
      <div class="space-y-2 text-sm text-foreground/70">
        <p><b>2D / 3D 切换</b>：右上角开关切换，3D 模式已开启真实地形起伏。</p>
        <p><b>图层</b>：支持电子地图与卫星影像互斥切换，叠加文字、路网。</p>
      </div>
    `,
  },
];
</script>

<template>
  <Page title="高德地图插件">
    <template #description>
      <div class="mt-2 text-foreground/80">
        完整的高德地图集成示例：2D / 3D 地形、图层、绘制、搜索、定位等。
      </div>
    </template>

    <Collapse class="mb-4" :items="collapseItems" />

    <Card class="mb-4" title="地图控制">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm">地图模式：</span>
          <Switch
            :checked="mode === '3d'"
            checked-children="3D"
            un-checked-children="2D"
            @change="toggleMode"
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm">状态：</span>
          <Tag :color="isReady ? 'green' : 'orange'">
            {{ isReady ? '已就绪' : '加载中' }}
          </Tag>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm">快速跳转：</span>
          <Button size="small" @click="goCity([116.397, 39.892])">北京</Button>
          <Button size="small" @click="goCity([121.473, 31.23])">上海</Button>
          <Button size="small" @click="goCity([113.264, 23.129])">广州</Button>
        </div>
      </div>
    </Card>

    <div class="flex h-[800px] w-full items-stretch gap-4">
      <!-- 继续使用 v-if 保证实例销毁重建，绝不白屏 -->
      <Card
        class="flex-1 overflow-hidden"
        :styles="{ body: { padding: 0, height: '100%' } }"
      >
        <AmapContainer class="h-full w-full" :api="currentApi">
          <Amap2d
            v-if="mode === '2d'"
            key="2d"
            class="h-full w-full"
            :api="api2d"
            :config="config2d"
          />
          <Amap3d
            v-else
            key="3d"
            class="h-full w-full"
            :api="api3d"
            :config="config3d"
          />
        </AmapContainer>
      </Card>

      <div class="flex w-[340px] shrink-0 flex-col gap-4">
        <div class="shrink-0 space-y-4">
          <Card title="地点搜索" size="small">
            <AmapSearch :api="currentApi" />
          </Card>
          <Card title="图层控制" size="small">
            <AmapLayer :api="currentApi" />
          </Card>
          <Card v-if="mode === '2d'" title="绘制工具" size="small">
            <AmapDraw :api="currentApi as IAmap2dApi" />
          </Card>
          <Card title="地图工具" size="small">
            <AmapToolbar :api="currentApi" @locate="handleLocate" />
          </Card>
          <Card title="实时状态" size="small">
            <AmapStatus :api="currentApi" />
          </Card>
        </div>

        <Card
          title="覆盖物"
          size="small"
          class="flex-1 flex flex-col overflow-hidden"
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
            v-if="currentApi.overlays.value.length === 0"
            class="text-xs text-foreground/50 mt-2"
          >
            暂无覆盖物
          </div>
          <div v-else class="flex flex-col h-full overflow-hidden">
            <div class="flex-1 overflow-y-auto space-y-1 pr-1">
              <div
                v-for="(overlay, index) in currentApi.overlays.value"
                :key="index"
                class="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
              >
                <span>覆盖物 {{ index + 1 }}</span>
                <Button
                  size="small"
                  type="text"
                  danger
                  @click="currentApi.removeOverlay(overlay)"
                >
                  删除
                </Button>
              </div>
            </div>
            <div class="pt-2 mt-auto shrink-0">
              <Button
                size="small"
                danger
                block
                @click="currentApi.clearOverlays()"
              >
                清除全部
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>
