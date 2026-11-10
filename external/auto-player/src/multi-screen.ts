import type {
  AutoMultiScreenPlayer,
  AutoPlayerOptions,
  AutoPlayerType,
} from './types';

import { useAutoPlayer } from './use-auto-player';

const SCALE_LABELS: Record<0 | 1 | 2, string> = {
  0: '拉伸填满',
  1: '等比留黑边',
  2: '等比裁切',
};

export function createAutoMultiScreenPlayers(
  url: string,
  forceType?: AutoPlayerType,
  opts: Omit<AutoPlayerOptions, 'initialUrl' | 'scaleMode'> = {},
): AutoMultiScreenPlayer[] {
  return ([0, 1, 2] as const).map((mode) => {
    const [Player, api] = useAutoPlayer({
      ...opts,
      initialUrl: url,
      initialType: forceType, // 👈 强制指定当前引擎
      scaleMode: mode,
      muted: true,
    });
    return {
      component: Player,
      props: {
        url,
        scaleMode: mode,
        api,
        type: forceType, // 👈 传给 AutoPlayer 组件
      },
      onDestroy: () => api.destroy(),
      label: SCALE_LABELS[mode],
      mode,
    };
  });
}
