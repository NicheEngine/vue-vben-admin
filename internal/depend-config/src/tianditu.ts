import { copyFile } from '@vben/node-utils';

const tiandituPath = 'libraries/tianditu';

const targets = {
  files: ['cesiumTdt.js', 'bytebuffer.min.js'],
} as const;

export const runTiandituScript = () => {
  copyFile(tiandituPath, 'public/tianditu', targets, true);
};
