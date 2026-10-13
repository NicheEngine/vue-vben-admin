import type { ExtendedJessibucaApi, JessibucaApiOptions } from './types';

import { useSelector } from '@vben-core/shared/store';

import { JessibucaPlayerApi } from './jessibuca-player-api';
import JessibucaPlayer from './jessibuca-player.vue';

/**
 * 创建 Jessibuca 播放器。
 *
 * 返回 `[Player, api]`：
 * - `Player`：播放器组件，使用时必须把 `api` 通过 props 传回去
 * - `api`：播放器实例，可调用 play/pause/setUrl/screenshot 等
 */
export function useJessibucaPlayer(options: JessibucaApiOptions = {}) {
  const api = new JessibucaPlayerApi(options);

  const extendedApi = api as unknown as ExtendedJessibucaApi;
  extendedApi.useSelector = (selector) => useSelector(api.store, selector);

  return [JessibucaPlayer, extendedApi] as const;
}
