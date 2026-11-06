import { describe, expect, it, vi } from 'vitest';
import { normalizeStats, safeUnsubscribe } from './index';

describe('normalizeStats', () => {
  it('should clamp abnormal values', () => {
    const raw = { buf: -100, fps: 9999, vbps: Infinity, ts: -5 };
    const result = normalizeStats(raw);

    expect(result.buf).toBe(0);
    expect(result.fps).toBe(240); // 截断至合理最大值
    expect(result.vbps).toBe(0); // Infinity 转为 0
    expect(result.ts).toBe(0);
  });

  it('should handle undefined/null gracefully', () => {
    const result = normalizeStats(null);
    expect(result).toEqual({ buf: 0, fps: 0, abps: 0, vbps: 0, ts: 0 });
  });
});

describe('safeUnsubscribe', () => {
  it('should handle function style', () => {
    const fn = vi.fn();
    safeUnsubscribe(fn);
    expect(fn).toHaveBeenCalled();
  });

  it('should handle object style', () => {
    const unsub = vi.fn();
    safeUnsubscribe({ unsubscribe: unsub });
    expect(unsub).toHaveBeenCalled();
  });

  it('should ignore null/undefined', () => {
    expect(() => safeUnsubscribe(null)).not.toThrow();
  });
});
