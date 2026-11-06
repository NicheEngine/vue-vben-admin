import type { EasyPlayerApiOptions } from '@vben/easy-player';
import type { JessibucaApiOptions } from '@vben/jessibuca-player';
import type { LivePlayerApiOptions } from '@vben/live-player';
import type { OssrsApiOptions } from '@vben/ossrs-player';
import type { IPlayerApi } from '@vben/player-types';

export type PlayerEngine = 'easy' | 'jessibuca' | 'live' | 'none' | 'ossrs';

export interface AutoPlayerProps {
  url: string;
  preferEngine?: PlayerEngine;
  autoplay?: boolean;
  muted?: boolean;
  class?: string;

  // 允许外部直接透传底层特定配置
  easyOptions?: Partial<EasyPlayerApiOptions>;
  jessibucaOptions?: Partial<JessibucaApiOptions>;
  liveOptions?: Partial<LivePlayerApiOptions>;
  ossrsOptions?: Partial<OssrsApiOptions>;
}

/**
 * AutoPlayer 暴露的 API 严格遵循 IPlayerApi 契约，
 * 并额外增加一个 getActiveEngine 和 getRawInstance 以便调试。
 */
export interface AutoPlayerApi extends IPlayerApi {
  getActiveEngine: () => PlayerEngine;
  getRawInstance: () => any;
}

export interface AutoPlayerExpose {
  api: AutoPlayerApi;
}
