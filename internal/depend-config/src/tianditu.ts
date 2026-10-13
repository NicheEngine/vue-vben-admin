import { copyFile } from '@vben/node-utils';

const TIANDITU_PATH = 'libraries/tianditu';

const TARGET_PATH = 'public/tianditu';

const targets = {
  files: ['cesiumTdt.js', 'bytebuffer.min.js'],
} as const;

export const runTiandituScript = (
  options?: boolean | { source?: string; target?: string },
) => {
  if (options === false) {
    return;
  }
  const source =
    (typeof options === 'object' && options?.source) || TIANDITU_PATH;
  const target =
    (typeof options === 'object' && options?.target) || TARGET_PATH;
  copyFile(source, target, targets, true);
};
