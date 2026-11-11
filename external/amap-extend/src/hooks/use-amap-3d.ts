import type { Amap3dConfig } from '../core/types';

import { effectScope, getCurrentScope, onScopeDispose } from 'vue';

import Amap3dComponent from '../amap-3d.vue';
import { createAmap3dAdapter } from '../core/adapter-3d';

export interface UseAmap3dOptions {
  config?: Amap3dConfig;
}

/**
 * 3D 地图组合式 API。
 *
 * 返回 `[Amap3dComponent, api, config, dispose]`：
 * - `dispose` 可在使用方主动调用；若在组件 setup 中调用，会自动随 scope 销毁。
 */
export function useAmap3d(options?: UseAmap3dOptions) {
  const scope = effectScope();
  const api = scope.run(() => createAmap3dAdapter());
  if (!api) {
    throw new Error('[useAmap3d] Failed to create adapter within effect scope');
  }
  const dispose = () => scope.stop();

  // 若当前有活跃 scope（组件内调用），自动挂到父 scope
  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }

  return [Amap3dComponent, api, options?.config, dispose] as const;
}
