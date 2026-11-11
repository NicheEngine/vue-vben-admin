import type { Component, Ref } from 'vue';

import type { EasyPlayerApiOptions } from '@vben/easy-player';
import type { JessibucaPlayerApiOptions } from '@vben/jessibuca-player';
import type { LivePlayerApiOptions } from '@vben/live-player';
import type { OssrsPlayerApiOptions } from '@vben/ossrs-player';
import type {
  IPlayerApi,
  IPlayerApiExt,
  IPlayerApiFull,
  PlayerCapabilities,
  PlayerStats,
} from '@vben/player-types';

/** 四个引擎类型 */
export type AutoPlayerType = 'easy' | 'jessibuca' | 'live' | 'ossrs';

export type AutoLatency = 'low' | 'normal';

export type UrlKind =
  | 'hls'
  | 'http-flv'
  | 'https-flv'
  | 'unknown'
  | 'webrtc'
  | 'whep'
  | 'ws-flv'
  | 'wss-flv';

export interface EngineCandidate {
  type: AutoPlayerType;
  label: string;
  available: boolean;
}

export interface ChooserInput {
  url: string;
  forceType?: AutoPlayerType;
  isH265?: boolean;
  latency?: AutoLatency;
  allowWebRTC?: boolean;
  allowMSE?: boolean;
}

export interface ChooserResult {
  type: AutoPlayerType;
  reason: string;
  fallback: AutoPlayerType[];
}

export interface EngineReady {
  easy: boolean;
  jessibuca: boolean;
  live: boolean;
  ossrs: boolean;
}

export interface AutoPlayerProps {
  /* 原样 */ url: string;
  type?: AutoPlayerType;
  isH265?: boolean;
  latency?: AutoLatency;
  autoplay?: boolean;
  muted?: boolean;
  scaleMode?: 0 | 1 | 2;
  api?: AutoPlayerApiLike;
  class?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

export type AutoPlayerApiLike = IPlayerApi &
  Required<IPlayerApiExt> & {
    screenshot: NonNullable<IPlayerApi['screenshot']>;
    startRecord: NonNullable<IPlayerApi['startRecord']>;
    stopRecordAndSave: NonNullable<IPlayerApi['stopRecordAndSave']>;
    setScaleMode: NonNullable<IPlayerApi['setScaleMode']>;
    resize: NonNullable<IPlayerApi['resize']>;
    seek: NonNullable<IPlayerApi['seek']>;
    setLoading: NonNullable<IPlayerApi['setLoading']>;
    togglePiP: NonNullable<IPlayerApi['togglePiP']>;
    getVideoElement: NonNullable<IPlayerApi['getVideoElement']>;
    requestFullscreen: NonNullable<IPlayerApi['requestFullscreen']>;
    exitFullscreen: NonNullable<IPlayerApi['exitFullscreen']>;
    setControlBarVisible: NonNullable<IPlayerApi['setControlBarVisible']>;
    setUrlAsync: NonNullable<IPlayerApi['setUrlAsync']>;
    getEngineType: () => AutoPlayerType | null;
    getChooserResult: () => ChooserResult | null;
    getAdapter: () => IPlayerApiFull | null;
    getCandidates: () => EngineCandidate[];
    switchType: (type: AutoPlayerType) => Promise<void>;
    onEngineChange: (cb: (type: AutoPlayerType) => void) => () => void;
    reset: () => Promise<void>;
  };

export interface AutoPlayerOptions {
  initialUrl?: string;
  initialType?: AutoPlayerType;
  isH265?: boolean;
  latency?: AutoLatency;
  muted?: boolean;
  autoplay?: boolean;
  scaleMode?: 0 | 1 | 2;

  // ===== 引擎专属透传（只影响对应引擎）=====
  /** easy-player 透传参数（覆盖 auto-player 默认） */
  easyOptions?: Partial<EasyPlayerApiOptions>;
  /** jessibuca 透传参数（覆盖 auto-player 默认） */
  jessibucaOptions?: Partial<JessibucaPlayerApiOptions>;
  /** live-player 透传参数（覆盖 auto-player 默认） */
  liveOptions?: Partial<LivePlayerApiOptions>;
  /** ossrs-player 透传参数（覆盖 auto-player 默认） */
  ossrsOptions?: Partial<OssrsPlayerApiOptions>;
}

export interface AutoMultiScreenPlayer {
  component: Component;
  props: Record<string, any>;
  onDestroy: () => Promise<void> | void;
  label: string;
  mode: number;
}

export interface ExtendedAutoPlayerApi extends AutoPlayerApiLike {
  useSelector: <T = any>(selector?: (state: any) => T) => Readonly<Ref<T>>;
}

export type { IPlayerApi, IPlayerApiExt, PlayerCapabilities, PlayerStats };
