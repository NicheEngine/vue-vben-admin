import { copyFile } from '@vben/node-utils';

const JESSIBUCA_PATH = 'libraries/jessibuca';

const TARGET_PATH = 'public/jessibuca';

const targets = {
  files: ['decoder.js', 'jessibuca.js', 'decoder.wasm'],
} as const;

export const runJessibucaScript = (
  options?: boolean | { source?: string; target?: string },
) => {
  if (options === false) {
    return;
  }
  const source =
    (typeof options === 'object' && options?.source) || JESSIBUCA_PATH;
  const target =
    (typeof options === 'object' && options?.target) || TARGET_PATH;
  copyFile(source, target, targets, true);
};
