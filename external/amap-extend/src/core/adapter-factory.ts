import type {
  AmapBaseState,
  AmapEventHandler,
  AmapEventType,
  CoordinateSystem,
  DrawOptions,
  IAmapCommonApi,
  OverlayRecord,
  OverlayType,
  Point,
} from './types';

import { ref, shallowRef } from 'vue';

import { useLoadAMap } from './loader';
import { AmapPluginManager } from './plugins';

let overlaySeq = 0;
const genId = (type: string) => `${type}-${Date.now()}-${overlaySeq++}`;

export interface AdapterCoreConfig<K extends '2d' | '3d'> {
  kind: K;
  createMap: (AMap: any, container: HTMLElement | string, config: any) => any;
  setupLayers?: (ctx: {
    AMap: any;
    map: any;
    layerCache: Record<string, any>;
    config: any;
  }) => void;
}

export type AdapterCore<K extends '2d' | '3d'> = AmapBaseState &
  IAmapCommonApi & {
    kind: K;
    init(container: HTMLElement | string, config?: any): Promise<void>;
  };

export function createAdapterCore<K extends '2d' | '3d'>(
  opts: AdapterCoreConfig<K>,
): AdapterCore<K> {
  const mapInstance = shallowRef<any>(null);
  const isReady = ref(false);
  const isLoading = ref(false);
  const error = ref<null | string>(null);

  const center = ref<Point>([116.397, 39.892]);
  const zoom = ref(15);
  const mousePosition = ref<null | Point>(null);
  const currentAddress = ref<null | string>(null);
  const overlays = ref<OverlayRecord[]>([]);
  const activeLayers = ref<string[]>([]);

  const pluginManager = new AmapPluginManager();
  const layerCache: Record<string, any> = {};
  const coordinateSystem = ref<CoordinateSystem>('GCJ02');

  const setCoordinateSystem = (sys: CoordinateSystem) => {
    coordinateSystem.value = sys;
  };

  /** 🔥 保存 AMap 引用，替代 window.AMap */
  let AMapRef: any = null;
  let geolocation: any = null;

  /** 通用事件总线：type -> Set<handler> */
  const eventBus = new Map<AmapEventType, Set<AmapEventHandler>>();
  const emit = (type: AmapEventType, e: any) => {
    eventBus.get(type)?.forEach((fn) => fn(e));
  };

  const convertFromGPS = (points: Point[]): Promise<Point[]> => {
    return new Promise((resolve, reject) => {
      if (!AMapRef) return reject(new Error('地图未初始化'));

      // 高德 convertFrom 单次最多支持 40 个点，这里处理单点即可
      AMapRef.convertFrom(points, 'gps', (status: string, result: any) => {
        if (status === 'complete' && result.locations) {
          resolve(result.locations.map((l: any) => [l.lng, l.lat]));
        } else {
          reject(new Error('坐标转换失败'));
        }
      });
    });
  };

  const on = (type: AmapEventType, handler: AmapEventHandler) => {
    const handlers = eventBus.get(type) ?? new Set<AmapEventHandler>();
    handlers.add(handler);
    eventBus.set(type, handlers); // 幂等：新 Set 或已存在的 Set 都行
    const map = mapInstance.value;
    if (map) map.on(type, handler);
    return () => off(type, handler);
  };

  const off = (type: AmapEventType, handler: AmapEventHandler) => {
    eventBus.get(type)?.delete(handler);
    mapInstance.value?.off?.(type, handler);
  };

  /** 反向绑定时把所有 eventBus 监听同步给 map */
  const bindEventBus = (map: any) => {
    eventBus.forEach((handlers, type) => {
      handlers.forEach((fn) => map.on(type, fn));
    });
  };

  const init = async (container: HTMLElement | string, config: any = {}) => {
    if (isReady.value) return;
    isLoading.value = true;
    error.value = null;

    try {
      const AMap = await useLoadAMap();
      AMapRef = AMap;

      const map = opts.createMap(AMap, container, config);
      mapInstance.value = map;

      // 图层初始化
      opts.setupLayers?.({ AMap, map, layerCache, config });

      // 事件绑定
      bindEventBus(map);

      map.on('moveend', () => {
        const c = map.getCenter();
        if (!c || c.lng === undefined) return;
        center.value = [c.lng, c.lat];
        zoom.value = map.getZoom();
        emit('moveend', { center: center.value, zoom: zoom.value });
        pluginManager
          .reverseGeocode(center.value)
          .then((addr) => (currentAddress.value = addr))
          .catch(() => {});
      });

      map.on('zoomchange', () => {
        emit('zoomchange', { zoom: map.getZoom() });
      });

      map.on('mousemove', (e: any) => {
        mousePosition.value = [e.lnglat.lng, e.lnglat.lat];
        emit('mousemove', e);
      });

      try {
        pluginManager.init(AMap, map);
        pluginManager
          .reverseGeocode(center.value)
          .then((addr) => (currentAddress.value = addr))
          .catch(() => {});
      } catch (error_) {
        console.warn('[AmapAdapter] 插件初始化失败', error_);
      }

      isReady.value = true;
      isLoading.value = false;
    } catch (error_: any) {
      error.value = error_.message || '地图加载失败';
      isLoading.value = false;
      throw error_;
    }
  };

  const destroy = async () => {
    pluginManager.destroy();
    mapInstance.value?.destroy();
    mapInstance.value = null;
    geolocation = null;
    AMapRef = null;
    isReady.value = false;
    eventBus.clear();
    overlays.value = [];
  };

  const setCenter = (pos: Point) => {
    mapInstance.value?.setCenter(pos);
    center.value = pos;
  };
  const setZoom = (val: number) => {
    mapInstance.value?.setZoom(val);
    zoom.value = val;
  };
  const fitView = (points: Point[]) => {
    if (!AMapRef) return;
    const lnglats = points.map((p) => new AMapRef.LngLat(p[0], p[1]));
    mapInstance.value?.setFitView(lnglats);
  };

  const setLayers = (layerNames: string[]) => {
    if (!mapInstance.value) return;
    if (layerNames.includes('satellite')) {
      layerCache.base?.hide();
      layerCache.satellite?.show();
    } else {
      layerCache.satellite?.hide();
      layerCache.base?.show();
    }
    if (layerCache.roadnet) {
      if (layerNames.includes('roadnet')) layerCache.roadnet.show();
      else layerCache.roadnet.hide();
    }
    if (layerCache.traffic) {
      if (layerNames.includes('traffic')) layerCache.traffic.show();
      else layerCache.traffic.hide();
    }
    activeLayers.value = layerNames;
  };

  const setFeatures = (features: string[]) => {
    mapInstance.value?.setFeatures(features);
  };

  /** 通用 overlay 注册 */
  const registerOverlay = (type: OverlayType, instance: any): OverlayRecord => {
    const record: OverlayRecord = { id: genId(type), type, instance };
    overlays.value = [...overlays.value, record];
    return record;
  };

  const addMarker = (position: Point, options?: any) => {
    const marker = new AMapRef.Marker({ position, ...options });
    mapInstance.value?.add(marker);
    registerOverlay('marker', marker);
    return marker;
  };
  const addCircle = (centerPos: Point, radius: number, options?: any) => {
    const circle = new AMapRef.Circle({
      center: centerPos,
      radius,
      ...options,
    });
    mapInstance.value?.add(circle);
    registerOverlay('circle', circle);
    return circle;
  };
  const addPolygon = (path: Point[], options?: any) => {
    const polygon = new AMapRef.Polygon({ path, ...options });
    mapInstance.value?.add(polygon);
    registerOverlay('polygon', polygon);
    return polygon;
  };
  const addPolyline = (path: Point[], options?: any) => {
    const polyline = new AMapRef.Polyline({ path, ...options });
    mapInstance.value?.add(polyline);
    registerOverlay('polyline', polyline);
    return polyline;
  };

  const removeOverlayById = (id: string) => {
    const record = overlays.value.find((o) => o.id === id);
    if (!record) return;
    record.instance?.setMap?.(null);
    mapInstance.value?.remove(record.instance);
    overlays.value = overlays.value.filter((o) => o.id !== id);
  };

  const removeOverlay = (overlay: any) => {
    const record = overlays.value.find((o) => o.instance === overlay);
    if (record) {
      removeOverlayById(record.id);
      return;
    }
    // 非本 adapter 管理的实例，直接移除但不影响记录
    overlay?.setMap?.(null);
    mapInstance.value?.remove(overlay);
  };

  /** 🔥 只清自己管理的覆盖物，不再 clearMap() */
  const clearOverlays = () => {
    overlays.value.forEach((o) => {
      o.instance?.setMap?.(null);
      mapInstance.value?.remove(o.instance);
    });
    overlays.value = [];
  };

  const getOverlaysByType = (type: OverlayType) =>
    overlays.value.filter((o) => o.type === type);

  const startDraw = (mode: OverlayType, options?: DrawOptions) => {
    pluginManager.startDraw(mode, options);
  };
  const stopDraw = () => pluginManager.stopDraw();
  const onDraw = (cb: (record: OverlayRecord) => void) => {
    return pluginManager.onDraw((instance) => {
      // 推断类型：MouseTool 绘制时无法直接知道类型，用位置特征简单判断
      let type: OverlayType = 'marker';
      if (typeof instance.getRadius === 'function') type = 'circle';
      else if (typeof instance.getPath === 'function') {
        const path = instance.getPath?.() ?? [];
        type = path.length > 2 ? 'polygon' : 'polyline';
      }
      const record = registerOverlay(type, instance);
      cb(record);
    });
  };

  const searchPOI = (
    kw: string,
    options?: { pageIndex?: number; pageSize?: number },
  ) => pluginManager.searchPOI(kw, options);
  const reverseGeocode = (pos: Point) => pluginManager.reverseGeocode(pos);

  /** 🔥 Geolocation 单例复用 */
  const triggerGeolocation = async (): Promise<Point> => {
    if (!AMapRef) throw new Error('地图尚未初始化');
    if (!geolocation) {
      geolocation = new AMapRef.Geolocation({
        enableHighAccuracy: true,
        timeout: 5000,
      });
    }
    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          const pos: Point = [result.position.lng, result.position.lat];
          setCenter(pos);
          resolve(pos);
        } else {
          reject(new Error('定位失败'));
        }
      });
    });
  };

  return {
    kind: opts.kind,
    // state
    isReady,
    isLoading,
    error,
    center,
    zoom,
    mousePosition,
    currentAddress,
    overlays,
    activeLayers,
    // lifecycle
    init,
    destroy,
    // map controls
    setCenter,
    setZoom,
    fitView,
    setLayers,
    setFeatures,
    // overlays
    addMarker,
    addCircle,
    addPolygon,
    addPolyline,
    removeOverlay,
    removeOverlayById,
    clearOverlays,
    getOverlaysByType,
    // draw
    startDraw,
    stopDraw,
    onDraw,
    // services
    searchPOI,
    reverseGeocode,
    triggerGeolocation,
    // events
    on,
    off,
    coordinateSystem,
    setCoordinateSystem,
    convertFromGPS,
    // instance
    getAMap: () => AMapRef, // 暴露全局 AMap 类
    getMapInstance: () => mapInstance.value, // 暴露地图实例
  };
}
