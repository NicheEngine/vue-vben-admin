import type { Point } from '@vben/amap';

export function formatPoint(p: null | Point | undefined, digits = 6): string {
  if (!p) return '-';
  return `${p[0].toFixed(digits)}, ${p[1].toFixed(digits)}`;
}

export function formatAddress(addr: null | string | undefined): string {
  return addr || '解析中...';
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '-';
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * 将高德地图覆盖物实例转换为标准 GeoJSON 对象
 */
export function convertOverlaysToGeoJSON(overlays: any[]): any {
  const features: any[] = [];

  overlays.forEach((overlay: any) => {
    if (!overlay) return;
    const type = overlay.CLASS_NAME || '';

    if (type.includes('Marker')) {
      const pos = overlay.getPosition?.();
      if (pos) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
          properties: {},
        });
      }
    } else if (type.includes('Polyline')) {
      const path = overlay.getPath?.();
      if (path && path.length > 0) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: path.map((p: any) => [p.lng, p.lat]),
          },
          properties: {},
        });
      }
    } else if (type.includes('Polygon')) {
      const path = overlay.getPath?.();
      if (path && path.length > 0) {
        const coords = path.map((p: any) => [p.lng, p.lat]);
        // 确保多边形闭合
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coords.push([...first]);
        }
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {},
        });
      }
    } else if (type.includes('Circle')) {
      // 高德 Circle 有时候没有 getPath，尝试处理
      if (typeof overlay.getPath === 'function') {
        const path = overlay.getPath();
        if (path && path.length > 0) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [path.map((p: any) => [p.lng, p.lat])],
            },
            properties: {},
          });
        }
      } else {
        const center = overlay.getCenter?.();
        const radius = overlay.getRadius?.();
        if (center) {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
            properties: { radius },
          });
        }
      }
    }
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * 将 JSON 对象导出下载为文件
 */
export function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
