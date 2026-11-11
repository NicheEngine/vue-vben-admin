// 视图组件
export { default as Amap2d } from './amap-2d.vue';
export { default as Amap3d } from './amap-3d.vue';
// UI 组件（假设你已经写了这些）
export { default as AmapContainer } from './components/amap-container.vue';

export { default as AmapDraw } from './components/amap-draw.vue';
export { default as AmapLayer } from './components/amap-layer.vue';

export { default as AmapSearch } from './components/amap-search.vue';
export { default as AmapStatus } from './components/amap-status.vue';
export { default as AmapToolbar } from './components/amap-toolbar.vue';
// 原有导出
export { DEFAULT_AMAP_PLUGINS, useLoadAMap } from './core/loader';

export type { AMapLoadConfig } from './core/loader';

export type * from './core/types';
// 组合式 API
export { useAmap2d } from './hooks/use-amap-2d';
export type { UseAmap2dOptions } from './hooks/use-amap-2d';
export { useAmap3d } from './hooks/use-amap-3d';
export type { UseAmap3dOptions } from './hooks/use-amap-3d';
// 插件加载 Hook
export { useAmapPlugin } from './hooks/use-amap-plugin';
