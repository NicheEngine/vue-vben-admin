// 缓存检测结果，避免重复 fetch
let cacheJessibuca: boolean | null = null;
let cacheEasyPlayer: boolean | null = null;

export async function checkJessibucaReady(): Promise<boolean> {
  if (cacheJessibuca !== null) return cacheJessibuca;
  if (typeof window === 'undefined') return false;

  const hasLib = typeof (window as any).Jessibuca === 'function';
  if (!hasLib) {
    cacheJessibuca = false;
    return false;
  }

  try {
    const [jsResp, wasmResp] = await Promise.all([
      fetch('/jessibuca/decoder.js', { method: 'HEAD' }).catch(() => ({
        ok: false,
      })),
      fetch('/jessibuca/decoder.wasm', { method: 'HEAD' }).catch(() => ({
        ok: false,
      })),
    ]);
    cacheJessibuca = jsResp.ok && wasmResp.ok;
  } catch {
    cacheJessibuca = false;
  }
  return cacheJessibuca;
}

export function checkEasyPlayerReady(): boolean {
  if (cacheEasyPlayer !== null) return cacheEasyPlayer;
  if (typeof window === 'undefined') return false;

  cacheEasyPlayer = !!window.customElements?.get('easy-player');
  return cacheEasyPlayer;
}
