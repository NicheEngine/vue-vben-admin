import type { ExtendedJessibucaApi, JessibucaApiOptions } from './types';

import { useSelector } from '@vben-core/shared/store';

import { JessibucaPlayerApi } from './jessibuca-player-api';
import JessibucaPlayer from './jessibuca-player.vue';

/**
 * 创建 Jessibuca 播放器 API + 组件
 *
 * @example
 * ```ts
 * const [Player, api] = useJessibuca({ url: 'ws://example.com/live.flv' })
 * ```
 */
export function useJessibucaPlayer(options: JessibucaApiOptions = {}) {
  const api = new JessibucaPlayerApi(options);
  const extendedApi = api as unknown as ExtendedJessibucaApi;

  extendedApi.useSelector = (selector) => useSelector(api.store, selector);

  return [JessibucaPlayer, extendedApi] as const;
}
