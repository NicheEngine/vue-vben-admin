import type { Amap3dConfig, IAmap3dApi } from './types';

import { ref } from 'vue';

import { createAdapterCore } from './adapter-factory';

export function createAmap3dAdapter(): IAmap3dApi {
  const pitch = ref(0);
  const rotation = ref(0);

  const core = createAdapterCore({
    kind: '3d',
    createMap: (AMap, container, config: Amap3dConfig) => {
      const mapLayers = config.terrain ? [new AMap.TileLayer.Satellite()] : [];
      return new AMap.Map(container, {
        viewMode: '3D',
        zoom: 15,
        center: [116.397, 39.892],
        pitch: 0,
        rotation: 0,
        ...config,
        ...(config.terrain ? { layers: mapLayers } : {}),
      });
    },
    setupLayers: ({ AMap, map, layerCache }) => {
      // 3D 不挂 RoadNet
      layerCache.base = new AMap.TileLayer();
      layerCache.satellite = new AMap.TileLayer.Satellite();
      layerCache.traffic = new AMap.TileLayer.Traffic();
      map.add([layerCache.base, layerCache.satellite, layerCache.traffic]);
      layerCache.base.hide();
      layerCache.satellite.hide();
      layerCache.traffic.hide();

      // 监听 moveend 补充 pitch/rotation
      map.on('moveend', () => {
        const p = map.getPitch?.();
        const r = map.getRotation?.();
        if (typeof p === 'number') pitch.value = p;
        if (typeof r === 'number') rotation.value = r;
      });
    },
  });

  const setPitch = (val: number) => {
    core.getMapInstance()?.setPitch(val);
    pitch.value = val;
  };
  const setRotation = (val: number) => {
    core.getMapInstance()?.setRotation(val);
    rotation.value = val;
  };

  return { ...core, pitch, rotation, setPitch, setRotation };
}
