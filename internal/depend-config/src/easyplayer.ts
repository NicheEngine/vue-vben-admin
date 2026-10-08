import { copyFile } from '@vben/node-utils';

const basePath = 'node_modules/@easydarwin/easyplayer/dist';
const elementPath = `${basePath}/element`;
const componentPath = `${basePath}/component`;

const elementTargets = {
  files: ['crossdomain.xml', 'EasyPlayer.wasm', 'EasyPlayer-element.min.js'],
} as const;

const componentTargets = {
  files: [
    'crossdomain.xml',
    'EasyPlayer.wasm',
    'EasyPlayer-lib.min.js',
    'EasyPlayer-component.min.js',
  ],
} as const;

/**
 * element 与 component 源目录不同，但都需输出到 public/easyplayer。
 * 两个函数不能都 clear 同一目录，否则后执行的会清空前一个的产物。
 * 解决方式：element 负责初始化目录（clear），component 追加（不 clear）。
 */
export const runElementScript = () => {
  copyFile(elementPath, 'public/easyplayer', elementTargets, true);
};

export const runComponentScript = () => {
  copyFile(componentPath, 'public/easyplayer', componentTargets, false);
};
