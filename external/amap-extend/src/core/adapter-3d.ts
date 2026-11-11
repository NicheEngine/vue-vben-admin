import type { Amap3dConfig, IAmap3dApi, Point } from './types';

import { onScopeDispose, ref, shallowRef } from 'vue';

import { useLoadAMap } from './loader';
import { AmapPluginManager } from './plugins';

export function createAmap3dAdapter(): IAmap3dApi {
  const mapInstance = shallowRef<any>(null);
  const isReady = ref(false);
  const isLoading = ref(false);
  const error = ref<null | string>(null);

  const center = ref<Point>([116.397, 39.892]);
  const zoom = ref(15);
  const pitch = ref(0);
  const rotation = ref(0);
  const mousePosition = ref<null | Point>(null);
  const currentAddress = ref<null | string>(null);
  const overlays = ref<any[]>([]);
  const activeLayers = ref<string[]>([]);

  const pluginManager = new AmapPluginManager();
  const layerCache: Record<string, any> = {};

  const init = async (
    container: HTMLElement | string,
    config: Amap3dConfig = {},
  ) => {
    if (isReady.value) return;
    isLoading.value = true;
    error.value = null;

    try {
      const AMap = await useLoadAMap();

      // 地形模式下必须给一个初始卫星底图
      const mapLayers = config.terrain ? [new AMap.TileLayer.Satellite()] : [];

      mapInstance.value = new AMap.Map(container, {
        viewMode: '3D',
        zoom: zoom.value,
        center: center.value,
        pitch: pitch.value,
        rotation: rotation.value,
        ...config,
        ...(config.terrain ? { layers: mapLayers } : {}),
      });

      // 🔥 3D 模式下：绝对不挂 RoadNet
      layerCache.base = new AMap.TileLayer();
      layerCache.satellite = new AMap.TileLayer.Satellite();
      layerCache.traffic = new AMap.TileLayer.Traffic();

      mapInstance.value.add([
        layerCache.base,
        layerCache.satellite,
        layerCache.traffic,
      ]);

      layerCache.base.hide();
      layerCache.satellite.hide();
      layerCache.traffic.hide();

      mapInstance.value.on('moveend', () => {
        const c = mapInstance.value.getCenter();
        if (!c || c.lng === undefined) return; // 防止地形异步报错
        center.value = [c.lng, c.lat];
        zoom.value = mapInstance.value.getZoom();
        pitch.value = mapInstance.value.getPitch();
        rotation.value = mapInstance.value.getRotation();
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
        console.warn('[Amap3dAdapter] 插件初始化失败', error_);
      }

      isReady.value = true;
      isLoading.value = false;
    } catch (error_: any) {
      error.value = error_.message || '3D 地图加载失败';
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
  const setPitch = (val: number) => {
    mapInstance.value?.setPitch(val);
    pitch.value = val;
  };
  const setRotation = (val: number) => {
    mapInstance.value?.setRotation(val);
    rotation.value = val;
  };
  const fitView = (points: Point[]) => {
    mapInstance.value?.setFitView(points);
  };

  const setLayers = (layerNames: string[]) => {
    if (!mapInstance.value) return;
    if (layerNames.includes('satellite')) {
      layerCache.base.hide();
      layerCache.satellite.show();
    } else {
      layerCache.satellite.hide();
      layerCache.base.show();
    }
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

  return {
    isReady,
    isLoading,
    error,
    center,
    zoom,
    pitch,
    rotation,
    mousePosition,
    currentAddress,
    overlays,
    activeLayers,
    init,
    destroy,
    setCenter,
    setZoom,
    setPitch,
    setRotation,
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
    getMapInstance: () => mapInstance.value,
  };
}
