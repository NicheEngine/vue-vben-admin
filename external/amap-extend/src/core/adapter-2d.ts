import type { Amap2dConfig, IAmap2dApi } from './types';

import { createAdapterCore } from './adapter-factory';

export function createAmap2dAdapter(): IAmap2dApi {
  const core = createAdapterCore({
    kind: '2d',
    createMap: (AMap, container, config: Amap2dConfig) =>
      new AMap.Map(container, {
        viewMode: '2D',
        zoom: 15,
        center: [116.397, 39.892],
        ...config,
      }),
    setupLayers: ({ AMap, map, layerCache }) => {
      layerCache.base = new AMap.TileLayer();
      layerCache.satellite = new AMap.TileLayer.Satellite();
      layerCache.roadnet = new AMap.TileLayer.RoadNet();
      layerCache.traffic = new AMap.TileLayer.Traffic();
      map.add([
        layerCache.base,
        layerCache.satellite,
        layerCache.roadnet,
        layerCache.traffic,
      ]);
      layerCache.satellite.hide();
      layerCache.roadnet.hide();
      layerCache.traffic.hide();
    },
  });

  return core;
}
