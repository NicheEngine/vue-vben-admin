import AMapLoader from '@amap/amap-jsapi-loader';

export interface AMapLoadConfig {
  AMapUI?: { plugins?: string[]; version?: string };
  key: string;
  Loca?: { version?: string };
  plugins?: string[];
  version: string;
}

const PATCHED = Symbol('amap-canvas2d-patched');

function canvas2dPerformancePatch(): void {
  const proto = HTMLCanvasElement.prototype as any;
  if (proto[PATCHED]) return;

  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'getContext',
  );
  if (!descriptor || typeof descriptor.value !== 'function') {
    return;
  }

  const originalGetContext = descriptor.value as (
    this: HTMLCanvasElement,
    contextId: string,
    options?: any,
  ) => null | RenderingContext;

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

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[amap] Missing required env: ${name}. Please set it in .env or .env.local.`,
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
  'AMap.PlaceSearch',
];

export const DEFAULT_AMAP_UI_CONFIG = {
  version: import.meta.env.VITE_AMAP_UI_VERSION || '1.1',
  plugins: parseList(import.meta.env.VITE_AMAP_UI_PLUGINS, [
    'geo/DistrictExplorer',
  ]),
};

export const DEFAULT_AMAP_LOAD_CONFIG = {
  key: import.meta.env.VITE_AMAP_SECRET_KEY || '',
  // 🔥 核心修改：必须使用 2.1Beta 才能支持地形
  version: import.meta.env.VITE_AMAP_API_VERSION || '2.1Beta',
  plugins: parseList(
    import.meta.env.VITE_AMAP_API_PLUGINS,
    DEFAULT_AMAP_PLUGINS,
  ),
};

let loadingPromise: null | Promise<any> = null;

export function useLoadAMap(
  config?: Partial<AMapLoadConfig>,
  securityJsCode?: string,
): Promise<any> {
  if (loadingPromise) return loadingPromise;

  const finalKey = config?.key || DEFAULT_AMAP_LOAD_CONFIG.key;
  if (!finalKey) {
    return Promise.reject(
      new Error(
        `[amap] Missing required env: VITE_AMAP_SECRET_KEY. Please set it in .env or .env.local.`,
      ),
    );
  }

  (window as any)._AMapSecurityConfig = {
    securityJsCode: requireEnv(
      'VITE_AMAP_SECURITY_CODE',
      securityJsCode || import.meta.env.VITE_AMAP_SECURITY_CODE,
    ),
  };

  const defaultConfig: AMapLoadConfig = {
    ...DEFAULT_AMAP_LOAD_CONFIG,
    key: finalKey,
    ...(parseBool(import.meta.env.VITE_AMAP_UI_ENABLED, false)
      ? { AMapUI: { ...DEFAULT_AMAP_UI_CONFIG } }
      : {}),
  };

  const p = AMapLoader.load(Object.assign({}, defaultConfig, config))
    .then((amap: any) => {
      canvas2dPerformancePatch();
      return amap;
    })
    .catch((error: any) => {
      if (loadingPromise === p) loadingPromise = null;
      throw error;
    });

  loadingPromise = p;
  return p;
}
