<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card } from 'antdv-next';

defineOptions({ name: 'CesiumPluginExample' });

const cesiumContainer = ref<HTMLDivElement>();
let viewer: any | null = null;

onMounted(() => {
  const Cesium = (window as any).Cesium;
  if (!Cesium) {
    console.error(
      '[Cesium Plugin] 未检测到全局 Cesium，请检查 index.html 中的 <script> 引入',
    );
    return;
  }
  if (!cesiumContainer.value) return;

  viewer = new Cesium.Viewer(cesiumContainer.value, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: false,
    fullscreenButton: true,
    infoBox: false,
    selectionIndicator: false,
  });

  // 默认视角：中国区域
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(116.39, 39.9, 10_000_000),
  });
});

onBeforeUnmount(() => {
  if (viewer) {
    try {
      viewer.destroy();
    } catch (error) {
      console.warn('[Cesium Plugin] viewer.destroy 失败：', error);
    }
    viewer = null;
  }
});
</script>

<template>
  <Page title="Cesium 插件">
    <template #description>
      <div class="mt-2 text-foreground/80">
        集成 Cesium 三维地球，用于加载天地图影像、注记与三维地形。
      </div>
    </template>

    <Card title="三维地球">
      <div
        ref="cesiumContainer"
        class="h-[600px] w-full overflow-hidden rounded-xl border border-border"
      ></div>
    </Card>
  </Page>
</template>
