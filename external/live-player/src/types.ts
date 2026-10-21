import type { HlsConfig } from 'hls.js';
import type Mpegts from 'mpegts.js';

import type { Ref } from 'vue';

import type { LivePlayerApi } from './live-player-api';

export enum LiveType {
  HLS = 'hls',
  MPEGTS = 'mpegts',
}

export interface MpegtsOptions {
  config?: Partial<Mpegts.Config>;
  datasource?: Partial<Mpegts.MediaDataSource>;
}

/** 播放器属性（用户可配置，单向输入） */
export interface LivePlayerProps {
  autoplay?: boolean;
  class?: string;
  controls?: boolean;
  hlsOptions?: Partial<HlsConfig>;
  mpegtsOptions?: MpegtsOptions;
  muted?: boolean;
  type?: LiveType;
  url: string;
}

/** 播放器内部状态（运行时可写） */
export interface LivePlayerState {
  currentTime: number;
  error: null | string;
  isLoading: boolean;
  isPlaying: boolean;
  isReady: boolean;
  volume: number;
  videoWidth: number;
  videoHeight: number;
  networkDelay: number;
  stats: any | null;
}

export type LivePlayerStoreState = LivePlayerProps & LivePlayerState;

/** 扩展的播放器 API，包含响应式 store 访问 */
export type ExtendedLivePlayerApi = LivePlayerApi & {
  useSelector: <T = LivePlayerStoreState>(
    selector?: (state: LivePlayerStoreState) => T,
  ) => Readonly<Ref<T>>;
};

/** 创建播放器 API 时的配置项 */
export interface LivePlayerApiOptions extends Partial<LivePlayerStoreState> {
  onError?: (error: Error) => void;
  onLoadEnd?: () => void;
  onLoadStart?: () => void;
  onPause?: () => void;
  onPlay?: () => void;
  onReady?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onUrlChange?: (url: string) => void;
  onVolumeChange?: (volume: number) => void;
}

/** 组件 emit 事件（组件层通道，与 API 回调独立） */
export interface LivePlayerEmits {
  play: [];
  pause: [];
  error: [error: Error | string];
  loadStart: [];
  loadEnd: [];
  ready: [];
  timeUpdate: [currentTime: number];
  volumeChange: [volume: number];
  fullscreen: [isFullscreen: boolean];
  ended: [];
}
