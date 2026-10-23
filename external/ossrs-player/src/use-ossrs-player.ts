import type {
  ExtendedOssrsPlayerApi,
  OssrsApiOptions,
  OssrsPlayerInnerProps,
} from './types';

import { defineComponent, h } from 'vue';

import { useSelector } from '@vben-core/shared/store';

import { OssrsPlayerApi } from './ossrs-player-api';
import OssrsPlayer from './ossrs-player.vue';

export function useOssrsPlayer(options: OssrsApiOptions = {}) {
  const api = new OssrsPlayerApi(options);

  const extendedApi = api as ExtendedOssrsPlayerApi;
  extendedApi.useSelector = (selector) => useSelector(api.store, selector);

  const Player = defineComponent(
    (props: OssrsPlayerInnerProps, { attrs, slots }) => {
      return () =>
        h(
          OssrsPlayer,
          { ...attrs, ...props, api: extendedApi } as Record<string, unknown>,
          slots,
        );
    },
    {
      name: 'OssrsPlayer',
      inheritAttrs: false,
    },
  );

  return [Player, extendedApi] as const;
}
