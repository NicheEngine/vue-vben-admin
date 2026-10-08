import type { App } from 'vue';

import type {
  AMap,
  AMapLoadConfig,
  AMapLoadingPromise,
  AMapSetupOptions,
} from './types';

import { merge } from '@vben/utils';

import AMapLoader from '@amap/amap-jsapi-loader';

const PATCHED = Symbol('amap-canvas2d-patched');

function canvas2dPerformancePatch(): void {
  const proto = HTMLCanvasElement.prototype as any;
  if (proto[PATCHED]) return;

  const originalGetContext: HTMLCanvasElement['getContext'] =
    HTMLCanvasElement.prototype.getContext;

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    enumerable: true,
    writable: true,
    value(this: HTMLCanvasElement, contextId: string, options?: any) {
      if (contextId === '2d') {
        return originalGetContext.call(this, contextId, {
          willReadFrequently: true,
          ...options,
        });
      }
      return originalGetContext.call(this, contextId, options);
    },
  });

  proto[PATCHED] = true;
}

/** 环境变量按逗号分隔解析为数组 */
function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 环境变量按 "true"/"1" 解析为 boolean */
function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

/** 读取必填环境变量，缺失时抛错 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[amap] Missing required env: ${name}. ` +
        `Please set it in .env or .env.local.`,
    );
  }
  return value;
}

export const DEFAULT_AMAP_PLUGINS = [
  'AMap.Scale',
  'AMap.ToolBar',
  'AMap.GeoJSON',
  'AMap.MarkerClusterer',
  'AMap.OverView',
  'AMap.MapType',
  'AMap.Geolocation',
  'AMap.ControlBar',
  'AMap.ElasticMarker',
  'AMap.DistrictSearch',
  'AMap.Geocoder',
  'AMap.CircleEditor',
  'AMap.PolygonEditor',
  'AMap.PolylineEditor',
  'AMap.PolyEditor',
  'AMap.RangingTool',
  'AMap.Weather',
  'AMap.MouseTool',
  'AMap.MoveAnimation',
];

export const DEFAULT_AMAP_UI_CONFIG = {
  version: import.meta.env.VITE_AMAP_UI_VERSION || '1.1',
  plugins: parseList(import.meta.env.VITE_AMAP_UI_PLUGINS, [
    'geo/DistrictExplorer',
  ]),
};

export const DEFAULT_AMAP_LOAD_CONFIG = {
  key: requireEnv('VITE_AMAP_SECRET_KEY', import.meta.env.VITE_AMAP_SECRET_KEY),
  version: import.meta.env.VITE_AMAP_API_VERSION || '2.1Beta',
  plugins: parseList(
    import.meta.env.VITE_AMAP_API_PLUGINS,
    DEFAULT_AMAP_PLUGINS,
  ),
};

let loadingPromise: AMapLoadingPromise = null;

export function useLoadAMap(
  config?: AMapLoadConfig,
  securityJsCode?: string,
): Promise<AMap> {
  if (loadingPromise) return loadingPromise;

  window._AMapSecurityConfig = {
    securityJsCode: requireEnv(
      'VITE_AMAP_SECURITY_CODE',
      securityJsCode || import.meta.env.VITE_AMAP_SECURITY_CODE,
    ),
  };

  // 浅拷贝，避免污染默认常量
  const defaultConfig: AMapLoadConfig = {
    ...DEFAULT_AMAP_LOAD_CONFIG,
    ...(parseBool(import.meta.env.VITE_AMAP_UI_ENABLED, false)
      ? { AMapUI: { ...DEFAULT_AMAP_UI_CONFIG } }
      : {}),
  };

  const p = AMapLoader.load(
    merge((config || {}) as AMapLoadConfig, defaultConfig),
  )
    .then((amap: AMap) => {
      canvas2dPerformancePatch();
      return amap;
    })
    .catch((error: any) => {
      // 只有当前 Promise 仍是 loadingPromise 时才清空，避免竞态
      if (loadingPromise === p) loadingPromise = null;
      throw error;
    });

  loadingPromise = p;
  return p;
}

export const setupInitAMap = (app: App, options?: AMapSetupOptions) => {
  const useAmapProvide = parseBool(
    import.meta.env.VITE_AMAP_API_PROVIDE,
    false,
  );
  const { loadConfig, securityCode } = options || {};

  useLoadAMap(loadConfig, securityCode)
    .then((amap: AMap) => {
      app.config.globalProperties.AMap = amap;
      if (useAmapProvide) {
        app.provide('AMap', amap);
        if (parseBool(import.meta.env.VITE_AMAP_UI_ENABLED, false)) {
          app.provide('AMapUI', window.AMapUI);
        }
      }
    })
    .catch((error) => {
      console.error('AMap setup failed:', error);
    });
};

export * from './types';
export default setupInitAMap;
