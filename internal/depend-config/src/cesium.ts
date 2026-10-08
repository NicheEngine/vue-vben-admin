import { copyFile } from '@vben/node-utils';

const cesiumPath = 'node_modules/cesium/Build/CesiumUnminified';

const targets = {
  directories: ['Assets', 'ThirdParty', 'Widgets', 'Workers'],
  files: ['Cesium.js'],
} as const;

export const runCesiumScript = () => {
  copyFile(cesiumPath, 'public/cesium', targets, true);
};
