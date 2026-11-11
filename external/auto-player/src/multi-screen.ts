import type {
  AutoMultiScreenPlayer,
  AutoPlayerOptions,
  AutoPlayerType,
} from './types';

import { checkEngineReadySync } from './engine-ready';
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
  // forceType 不可用时回退自动选型，避免三屏全黑
  const ready = checkEngineReadySync();
  const safeType = forceType && ready[forceType] ? forceType : undefined;

  return ([0, 1, 2] as const).map((mode) => {
    const [Player, api] = useAutoPlayer({
      ...opts,
      initialUrl: url,
      initialType: safeType,
      scaleMode: mode,
      muted: true,
    });
    return {
      component: Player,
      props: {
        url,
        scaleMode: mode,
        api,
        type: safeType,
      },
      onDestroy: () => api.destroy(),
      label: SCALE_LABELS[mode],
      mode,
    };
  });
}
