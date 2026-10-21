import type {
  ExtendedLivePlayerApi,
  LivePlayerApiOptions,
  LivePlayerProps,
} from './types';

import { defineComponent, h } from 'vue';

import { useSelector } from '@vben-core/shared/store';

import { LivePlayerApi } from './live-player-api';
import EngineLivePlayer from './live-player.vue';

const DEFAULT_PROPS: Partial<LivePlayerProps> = {};

export function setDefaultLivePlayerProps(props: Partial<LivePlayerProps>) {
  Object.assign(DEFAULT_PROPS, props);
}

export function useLivePlayer<
  TParentProps extends LivePlayerProps = LivePlayerProps,
>(options: LivePlayerApiOptions = {}) {
  const api = new LivePlayerApi({
    ...DEFAULT_PROPS,
    ...options,
  });

  const extendedApi = api as ExtendedLivePlayerApi;
  extendedApi.useSelector = (selector) => useSelector(api.store, selector);

  const LivePlayer = defineComponent(
    (props: TParentProps, { attrs, slots }) => {
      return () =>
        h(
          EngineLivePlayer,
          {
            ...props,
            ...attrs,
            livePlayerApi: extendedApi,
          } as any,
          slots,
        );
    },
    {
      name: 'EngineLivePlayer',
      inheritAttrs: false,
    },
  );

  return [LivePlayer, extendedApi] as const;
}
