import type { EasyPlayerApiOptions, ExtendedEasyPlayerApi } from './types';

import { useSelector } from '@vben-core/shared/store';

import { EasyPlayerApi } from './easy-player-api';
import EasyPlayer from './easy-player.vue';

export function useEasyPlayer(options: EasyPlayerApiOptions = {}) {
  const api = new EasyPlayerApi(options);
  const extendedApi = api as unknown as ExtendedEasyPlayerApi;

  extendedApi.useSelector = (selector) => useSelector(api.store, selector);

  return [EasyPlayer, extendedApi] as const;
}
