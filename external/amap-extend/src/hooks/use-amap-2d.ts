import type { Amap2dConfig } from '../core/types';

import Amap2dComponent from '../amap-2d.vue';
import { createAmap2dAdapter } from '../core/adapter-2d';

export interface UseAmap2dOptions {
  config?: Amap2dConfig;
}

/**
 * 2D 地图组合式 API。
 *
 * 返回 `[Amap2dComponent, api]`：
 * - `Amap2dComponent`：Vue 组件，挂载后自动初始化地图
 * - `api`：地图实例 API，包含完整状态与控制方法
 *
 * @example
 * ```vue
 * <script setup>
 * const [Amap, api] = useAmap2d({ config: { center: [116.39, 39.9], zoom: 15 } });
 * </script>
 * <template>
 *   <Amap class="h-[600px]" :api="api" :config="apiConfig" />
 * </template>
 * ```
 */
export function useAmap2d(options?: UseAmap2dOptions) {
  const api = createAmap2dAdapter();
  return [Amap2dComponent, api, options?.config] as const;
}
