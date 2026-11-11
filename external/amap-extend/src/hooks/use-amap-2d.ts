import type { Amap2dConfig } from '../core/types';

import { effectScope, getCurrentScope, onScopeDispose } from 'vue';

import Amap2dComponent from '../amap-2d.vue';
import { createAmap2dAdapter } from '../core/adapter-2d';

export interface UseAmap2dOptions {
  config?: Amap2dConfig;
}

/**
 * 2D 地图组合式 API。
 *
 * 返回 `[Amap2dComponent, api, config, dispose]`：
 * - `dispose` 可在使用方主动调用；若在组件 setup 中调用，会自动随 scope 销毁。
 */
export function useAmap2d(options?: UseAmap2dOptions) {
  const scope = effectScope();
  const api = scope.run(() => createAmap2dAdapter());
  if (!api) {
    throw new Error('[useAmap2d] Failed to create adapter within effect scope');
  }
  const dispose = () => scope.stop();

  // 若当前有活跃 scope（组件内调用），自动挂到父 scope
  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }

  return [Amap2dComponent, api, options?.config, dispose] as const;
}
