import { copyFile } from '@vben/node-utils';

const EASYPLAYER_PATH = `node_modules/@easydarwin/easyplayer/dist/element`;
const TARGET_PATH = 'public/easyplayer';

const targets = {
  files: ['crossdomain.xml', 'EasyPlayer.wasm', 'EasyPlayer-element.min.js'],
} as const;

/**
 * element 与 component 源目录不同，但都需输出到 public/easyplayer。
 * 两个函数不能都 clear 同一目录，否则后执行的会清空前一个的产物。
 * 解决方式：element 负责初始化目录（clear），component 追加（不 clear）。
 */
export const runEasyplayerScript = (
  options?: boolean | { source?: string; target?: string },
) => {
  if (options === false) {
    return;
  }
  const source =
    (typeof options === 'object' && options?.source) || EASYPLAYER_PATH;
  const target =
    (typeof options === 'object' && options?.target) || TARGET_PATH;
  copyFile(source, target, targets, true);
};
