import type { Amap2dConfig, IAmap2dApi, Point } from './types';

import { onScopeDispose, ref, shallowRef } from 'vue';

import { useLoadAMap } from './loader';
import { AmapPluginManager } from './plugins';

export function createAmap2dAdapter(): IAmap2dApi {
  const mapInstance = shallowRef<any>(null);
  const isReady = ref(false);
  const isLoading = ref(false);
  const error = ref<null | string>(null);

  const center = ref<Point>([116.397, 39.892]);
  const zoom = ref(15);
  const mousePosition = ref<null | Point>(null);
  const currentAddress = ref<null | string>(null);
  const overlays = ref<any[]>([]);
  const activeLayers = ref<string[]>([]);

  const pluginManager = new AmapPluginManager();
  const layerCache: Record<string, any> = {};

  const init = async (
    container: HTMLElement | string,
    config: Amap2dConfig = {},
  ) => {
    if (isReady.value) return;
    isLoading.value = true;
    error.value = null;

    try {
      const AMap = await useLoadAMap();

      mapInstance.value = new AMap.Map(container, {
        viewMode: '2D',
        zoom: zoom.value,
        center: center.value,
        ...config,
      });

      // 2D 图层缓存
      layerCache.base = new AMap.TileLayer();
      layerCache.satellite = new AMap.TileLayer.Satellite();
      layerCache.roadnet = new AMap.TileLayer.RoadNet();
      layerCache.traffic = new AMap.TileLayer.Traffic();

      mapInstance.value.add([
        layerCache.base,
        layerCache.satellite,
        layerCache.roadnet,
        layerCache.traffic,
      ]);

      layerCache.satellite.hide();
      layerCache.roadnet.hide();
      layerCache.traffic.hide();

      mapInstance.value.on('moveend', () => {
        const c = mapInstance.value.getCenter();
        if (!c) return;
        center.value = [c.lng, c.lat];
        zoom.value = mapInstance.value.getZoom();
        pluginManager
          .reverseGeocode(center.value)
          .then((addr) => (currentAddress.value = addr))
          .catch(() => {});
      });

      mapInstance.value.on('mousemove', (e: any) => {
        mousePosition.value = [e.lnglat.lng, e.lnglat.lat];
      });

      try {
        pluginManager.init(AMap, mapInstance.value);
        pluginManager
          .reverseGeocode(center.value)
          .then((addr) => (currentAddress.value = addr))
          .catch(() => {});
      } catch (error_) {
        console.warn('[Amap2dAdapter] 插件初始化失败', error_);
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
    isReady.value = false;
  };

  onScopeDispose(() => void destroy());

  const setCenter = (pos: Point) => {
    mapInstance.value?.setCenter(pos);
    center.value = pos;
  };
  const setZoom = (val: number) => {
    mapInstance.value?.setZoom(val);
    zoom.value = val;
  };
  const fitView = (points: Point[]) => {
    mapInstance.value?.setFitView(points);
  };

  const setLayers = (layerNames: string[]) => {
    if (!mapInstance.value || !layerCache.base) return;

    if (layerNames.includes('satellite')) {
      layerCache.base.hide();
      layerCache.satellite.show();
    } else {
      layerCache.satellite.hide();
      layerCache.base.show();
    }

    if (layerNames.includes('roadnet')) layerCache.roadnet.show();
    else layerCache.roadnet.hide();

    if (layerNames.includes('traffic')) layerCache.traffic.show();
    else layerCache.traffic.hide();

    activeLayers.value = layerNames;
  };

  const setFeatures = (features: string[]) => {
    mapInstance.value?.setFeatures(features);
  };

  const addMarker = (position: Point, options?: any) => {
    const marker = new (window as any).AMap.Marker({ position, ...options });
    mapInstance.value?.add(marker);
    overlays.value.push(marker);
    return marker;
  };
  const addCircle = (centerPos: Point, radius: number, options?: any) => {
    const circle = new (window as any).AMap.Circle({
      center: centerPos,
      radius,
      ...options,
    });
    mapInstance.value?.add(circle);
    overlays.value.push(circle);
    return circle;
  };
  const addPolygon = (path: Point[], options?: any) => {
    const polygon = new (window as any).AMap.Polygon({ path, ...options });
    mapInstance.value?.add(polygon);
    overlays.value.push(polygon);
    return polygon;
  };
  const addPolyline = (path: Point[], options?: any) => {
    const polyline = new (window as any).AMap.Polyline({ path, ...options });
    mapInstance.value?.add(polyline);
    overlays.value.push(polyline);
    return polyline;
  };

  const removeOverlay = (overlay: any) => {
    overlay.setMap?.(null);
    mapInstance.value?.remove(overlay);
    overlays.value = overlays.value.filter((o) => o !== overlay);
  };
  const clearOverlays = () => {
    overlays.value.forEach((o) => o.setMap?.(null));
    mapInstance.value?.clearMap();
    overlays.value = [];
  };

  const startDraw = (mode: any) => pluginManager.startDraw(mode);
  const stopDraw = () => pluginManager.stopDraw();
  const searchPOI = (kw: string) => pluginManager.searchPOI(kw);
  const reverseGeocode = (pos: Point) => pluginManager.reverseGeocode(pos);
  const triggerGeolocation = async (): Promise<Point> => {
    return new Promise((resolve, reject) => {
      const geolocation = new (window as any).AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 5000,
      });
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          const pos: Point = [result.position.lng, result.position.lat];
          setCenter(pos);
          resolve(pos);
        } else reject(new Error('定位失败'));
      });
    });
  };

  return {
    isReady,
    isLoading,
    error,
    center,
    zoom,
    mousePosition,
    currentAddress,
    overlays,
    activeLayers,
    init,
    destroy,
    setCenter,
    setZoom,
    fitView,
    setLayers,
    setFeatures,
    addMarker,
    addCircle,
    addPolygon,
    addPolyline,
    removeOverlay,
    clearOverlays,
    startDraw,
    stopDraw,
    searchPOI,
    reverseGeocode,
    triggerGeolocation,
    getMapInstance: () => mapInstance.value,
  };
}
