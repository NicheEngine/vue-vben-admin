import type { Amap3dConfig } from '../core/types';

import Amap3dComponent from '../amap-3d.vue';
import { createAmap3dAdapter } from '../core/adapter-3d';

export interface UseAmap3dOptions {
  config?: Amap3dConfig;
}

/**
 * 3D 地图组合式 API。
 *
 * @example
 * ```vue
 * <script setup>
 * const [Amap, api, config] = useAmap3d({
 *   config: { center: [116.39, 39.9], zoom: 15, pitch: 45 }
 * });
 * </script>
 * <template>
 *   <Amap class="h-[600px]" :api="api" :config="config" />
 * </template>
 * ```
 */
export function useAmap3d(options?: UseAmap3dOptions) {
  const api = createAmap3dAdapter();
  return [Amap3dComponent, api, options?.config] as const;
}
