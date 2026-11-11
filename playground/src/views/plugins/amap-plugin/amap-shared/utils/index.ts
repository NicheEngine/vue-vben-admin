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
