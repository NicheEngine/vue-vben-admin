import { copyFile } from '@vben/node-utils';

const CESIUM_PATH = 'node_modules/cesium/Build/CesiumUnminified';

const TARGET_PATH = 'public/cesium';

const targets = {
  directories: ['Assets', 'ThirdParty', 'Widgets', 'Workers'],
  files: ['Cesium.js'],
} as const;

export const runCesiumScript = (
  options?: boolean | { source?: string; target?: string },
) => {
  if (options === false) {
    return;
  }
  const source =
    (typeof options === 'object' && options?.source) || CESIUM_PATH;
  const target =
    (typeof options === 'object' && options?.target) || TARGET_PATH;
  copyFile(source, target, targets, true);
};
