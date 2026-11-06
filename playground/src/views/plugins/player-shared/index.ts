// ============================================================
// 3. 通用 UI 组件
// ============================================================
export { default as MultiScreenCompare } from './components/multi-screen-compare.vue';

export { default as NetworkChart } from './components/network-chart.vue';

export { default as PlayStatusPanel } from './components/play-status-panel.vue';
export { default as PlayerControlCard } from './components/player-control-card.vue';
export { default as PlayerErrorOverlay } from './components/player-error-overlay.vue';
export { default as PlayerSizeCard } from './components/player-size-card.vue';
export { default as ProtocolDetect } from './components/protocol-detect.vue';
export { default as RecordPanel } from './components/record-panel.vue';
export { default as ScreenshotPreview } from './components/screenshot-preview.vue';
// ============================================================
// 2. 协议探测工具
// ============================================================
export {
  createDebounce,
  detectOssrsProtocol,
  detectProtocol,
  probeUrl,
} from './utils';
export type { ProbeResult, ProtocolInfo } from './utils';
// ============================================================
// 4. Adapter 工厂 (直接转发)
// ============================================================
export { createEasyAdapter } from '@vben/easy-player';
export { createJessibucaAdapter } from '@vben/jessibuca-player';

export { createLiveAdapter } from '@vben/live-player';
export { createOssrsAdapter } from '@vben/ossrs-player';
// ============================================================
// 1. 核心类型与工具 (从 player-types 转发)
// ============================================================
export type {
  IPlayerApi,
  PlayerCapabilities,
  PlayerStats,
} from '@vben/player-types';
export { normalizeStats, safeUnsubscribe } from '@vben/player-types';
