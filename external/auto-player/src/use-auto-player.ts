import type { AutoPlayerOptions, ExtendedAutoPlayerApi } from './types';

import { computed } from 'vue';

import { AutoPlayerApi } from './auto-player-api';
import AutoPlayer from './auto-player.vue';

export function useAutoPlayer(options: AutoPlayerOptions = {}) {
  const api = new AutoPlayerApi(options);
  const extendedApi = api as unknown as ExtendedAutoPlayerApi;

  // 轻量 useSelector：基于 computed 的只读投影
  extendedApi.useSelector = (selector?: (state: any) => any) =>
    computed(() => (selector ? selector(extendedApi) : extendedApi)) as any;

  void api.init(options.initialUrl);

  return [AutoPlayer, extendedApi] as const;
}
