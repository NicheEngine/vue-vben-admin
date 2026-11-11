export { default as AmapContainer } from './components/amap-container.vue';

export { default as AmapDraw } from './components/amap-draw.vue';

export { default as AmapLayer } from './components/amap-layer.vue';
export { default as AmapSearch } from './components/amap-search.vue';
export { default as AmapStatus } from './components/amap-status.vue';
export { default as AmapToolbar } from './components/amap-toolbar.vue';
export { formatAddress, formatDistance, formatPoint } from './utils';
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
