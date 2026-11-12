export { default as AmapCluster } from './components/base/amap-cluster.vue';
export { default as AmapContainer } from './components/base/amap-container.vue';
export { default as AmapDistrict } from './components/base/amap-district.vue';
export { default as AmapDraw } from './components/base/amap-draw.vue';
export { default as AmapFence } from './components/base/amap-fence.vue';
export { default as AmapHeatmap } from './components/base/amap-heatmap.vue';
export { default as AmapLayer } from './components/base/amap-layer.vue';
export { default as AmapMeasure } from './components/base/amap-measure.vue';
export { default as AmapPath } from './components/base/amap-path.vue';
export { default as AmapSearch } from './components/base/amap-search.vue';
export { default as AmapStatus } from './components/base/amap-status.vue';
export { default as AmapToolbar } from './components/base/amap-toolbar.vue';
export { default as AmapWeather } from './components/base/amap-weather.vue';

export { default as AmapFloatingDock } from './components/floating/amap-floating-dock.vue';
export { default as AmapFloatingDraw } from './components/floating/amap-floating-draw.vue';
export {
  convertOverlaysToGeoJSON,
  downloadJSON,
  formatAddress,
  formatDistance,
  formatPoint,
} from './utils';
export type {
  Amap2dConfig,
  Amap2dState,
  Amap3dConfig,
  Amap3dState,
  AmapBaseState,
  AmapEventHandler,
  AmapEventType,
  DrawOptions,
  IAmap2dApi,
  IAmap3dApi,
  IAmapCommonApi,
  OverlayRecord,
  OverlayType,
  Point,
} from '@vben/amap';
