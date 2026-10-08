import type { AMap2dConfig, AMap2dContext, AMap2dOptions } from '../types';

import { reactive } from 'vue';

import { merge } from '@vben/utils';

const DEFAULT_AMAP_2D_CONFIG: AMap2dConfig = {
  center: [116.3974768163, 39.8923925966],
  zoom: 20,
};

export const useAMap2dHook = () => {
  const context = reactive<AMap2dContext>({
    amap: null,
    mouseTool: null,
  });

  const initAMap2d = (options: AMap2dOptions): void => {
    const { container, config, mouseTool, satellite, callback } = options;

    if (!window.AMap) {
      throw new Error(
        'The `AMap` is unloaded, please check the `AMap` related configuration.',
      );
    }

    const merged = merge(
      (config || {}) as AMap2dConfig,
      DEFAULT_AMAP_2D_CONFIG,
      { viewMode: '2D' },
    );

    if (satellite) {
      merged.layers = [new window.AMap.TileLayer.Satellite()];
    }

    context.amap = new window.AMap.Map(container, merged);
    if (mouseTool) {
      context.mouseTool = new window.AMap.MouseTool(context.amap);
    }
    callback?.();
  };

  return { context, initAMap2d };
};

export default useAMap2dHook;
