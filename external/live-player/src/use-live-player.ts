import type {
  ExtendedLivePlayerApi,
  LivePlayerApiOptions,
  LivePlayerProps,
} from './types';

import {
  defineComponent,
  h,
  inject,
  nextTick,
  provide,
  reactive,
  ref,
} from 'vue';

import { useSelector } from '@vben-core/shared/store';

import { LivePlayerApi } from './live-player-api';
import EngineLivePlayer from './live-player.vue';

const INJECT_KEY = Symbol('ENGINE_LIVE_PLAYER');
const DEFAULT_PROPS: Partial<LivePlayerProps> = {};

type CallbackMap = {
  onError: (error: Error) => void;
  onLoadEnd: () => void;
  onLoadStart: () => void;
  onPause: () => void;
  onPlay: () => void;
  onReady: () => void;
  onTimeUpdate: (currentTime: number) => void;
  onUrlChange: (url: string) => void;
  onVolumeChange: (volume: number) => void;
};

type CallbackKey = keyof CallbackMap;

const callbackKeys: CallbackKey[] = [
  'onError',
  'onLoadEnd',
  'onLoadStart',
  'onPause',
  'onPlay',
  'onReady',
  'onTimeUpdate',
  'onUrlChange',
  'onVolumeChange',
];

function wrapCallback<K extends CallbackKey>(
  original: CallbackMap[K] | undefined,
  parent: CallbackMap[K] | undefined,
): CallbackMap[K] | undefined {
  if (!original && !parent) return undefined;
  const wrapped = (...args: any[]): void => {
    if (parent) (parent as (...a: any[]) => void).apply(null, args);
    if (original) (original as (...a: any[]) => void).apply(null, args);
  };
  return wrapped as CallbackMap[K];
}

export function setDefaultLivePlayerProps(props: Partial<LivePlayerProps>) {
  Object.assign(DEFAULT_PROPS, props);
}

export function useLivePlayer<
  TParentProps extends LivePlayerProps = LivePlayerProps,
>(options: LivePlayerApiOptions = {}) {
  const { connectedComponent } = options;

  if (connectedComponent) {
    const extendedApi = reactive({}) as ExtendedLivePlayerApi;
    const isReady = ref(true);

    const ParentLivePlayer = defineComponent(
      (props: TParentProps, { attrs, slots }) => {
        const parentInject = inject<any>(INJECT_KEY, {});
        provide(INJECT_KEY, {
          extendApi(api: ExtendedLivePlayerApi) {
            Object.assign(extendedApi, api);
          },
          options: { ...parentInject.options, ...options },
          async reCreate() {
            isReady.value = false;
            await nextTick();
            isReady.value = true;
          },
        });
        if (import.meta.env.DEV) {
          checkProps(extendedApi, { ...props, ...attrs });
        }
        return () =>
          h(
            isReady.value ? connectedComponent : 'div',
            { ...props, ...attrs } as any,
            slots,
          );
      },
      // eslint-disable-next-line vue/one-component-per-file
      {
        name: 'EngineParentLivePlayer',
        inheritAttrs: false,
      },
    );
    return [ParentLivePlayer, extendedApi] as const;
  }

  const parentInject = inject<any>(INJECT_KEY, {});

  const mergedOptions = {
    ...DEFAULT_PROPS,
    ...parentInject.options,
    ...options,
  } as LivePlayerApiOptions;

  callbackKeys.forEach((key) => {
    const original = mergedOptions[key];
    const parentHook = parentInject.options?.[key];
    if (original || parentHook) {
      mergedOptions[key] = wrapCallback(original, parentHook) as any;
    }
  });

  const api = new LivePlayerApi(mergedOptions);
  const extendedApi = api as ExtendedLivePlayerApi;

  extendedApi.useStore = (selector) => {
    return useSelector(api.store, selector);
  };

  const LivePlayer = defineComponent(
    (props: LivePlayerProps, { attrs, slots }) => {
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
    // eslint-disable-next-line vue/one-component-per-file
    {
      name: 'EngineLivePlayer',
      inheritAttrs: false,
    },
  );

  parentInject.extendApi?.(extendedApi);
  return [LivePlayer, extendedApi] as const;
}

async function checkProps(
  api: ExtendedLivePlayerApi,
  attrs: Record<string, any>,
) {
  if (!attrs || Object.keys(attrs).length === 0) return;
  await nextTick();
  const state = api?.store?.state;
  if (!state) return;
  const stateKeys = new Set(Object.keys(state));
  for (const key of Object.keys(attrs)) {
    if (stateKeys.has(key) && key !== 'class') {
      console.warn(
        `[EngineLivePlayer] Avoid passing "${key}" as prop to connectedComponent. Use API instead.`,
      );
    }
  }
}
