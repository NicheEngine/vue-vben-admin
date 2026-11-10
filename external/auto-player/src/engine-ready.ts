import type { AutoPlayerType, EngineReady } from './types';

/** 同步探测四引擎可用性（资源文件/打包依赖） */
export function checkEngineReadySync(): EngineReady {
  const hasWindow = typeof window !== 'undefined';
  let liveReady = false;
  if (hasWindow) {
    try {
      liveReady =
        typeof MediaSource !== 'undefined' &&
        (typeof MediaSource.isTypeSupported === 'function'
          ? MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')
          : true);
    } catch {
      liveReady = true;
    }
  }
  return {
    easy: hasWindow && !!window.customElements?.get('easy-player'),
    jessibuca: hasWindow && typeof (window as any).Jessibuca === 'function',
    live: liveReady,
    ossrs: hasWindow && typeof (window as any).RTCPeerConnection === 'function',
  };
}

/** 等待某引擎就绪（轮询），超时返回 false；live 同步确定 */
export function waitEngineReady(
  type: AutoPlayerType,
  timeout = 10_000,
  interval = 200,
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (type === 'live') return Promise.resolve(checkEngineReadySync().live);
  const deadline = Date.now() + timeout;
  return new Promise((resolve) => {
    const tick = () => {
      const ready = checkEngineReadySync();
      if (ready[type]) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(tick, interval);
    };
    tick();
  });
}
