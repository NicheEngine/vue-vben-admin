import { copyFile } from '@vben/node-utils';

const jessibucaPath = 'libraries/jessibuca';

const targets = {
  files: ['decoder.js', 'jessibuca.js', 'decoder.wasm'],
} as const;

export const runJessibucaScript = () => {
  copyFile(jessibucaPath, 'public/jessibuca', targets, true);
};
