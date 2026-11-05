import type { PlayerEngine } from './types';

export interface DetectOptions {
  hasJessibuca: boolean;
  hasEasyPlayer: boolean;
  preferEngine?: PlayerEngine;
}

export function detectEngine(
  url: string,
  options: DetectOptions,
): PlayerEngine {
  if (!url) return 'none';

  const lower = url.toLowerCase();
  // 1. 优先尊重用户的强制指定
  if (options.preferEngine && options.preferEngine !== 'none') {
    return options.preferEngine;
  }

  // 2. OSSRS (WebRTC 系)
  if (
    lower.startsWith('webrtc://') ||
    lower.startsWith('rtc://') ||
    lower.includes('/whep/') ||
    lower.includes('/whip-play/')
  ) {
    return 'ossrs';
  }

  // 3. HLS 协议 => LivePlayer
  if (lower.includes('.m3u8')) {
    return 'live';
  }

  // 4. FLV 协议 (优先级: Jessibuca > Easy > Live)
  if (lower.includes('.flv')) {
    if (options.hasJessibuca) return 'jessibuca';
    if (options.hasEasyPlayer) return 'easy';
    return 'live';
  }

  // 5. 兜底交给 LivePlayer
  return 'live';
}
