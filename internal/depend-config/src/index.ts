import { runCesiumScript } from './cesium';
import { runElementScript } from './easyplayer';
import { runJessibucaScript } from './jessibuca';
import { runTiandituScript } from './tianditu';

export interface DependOptions {
  jessibuca?: boolean;
  cesium?: boolean;
  easyplayer?: boolean;
  tianditu?: boolean;
}

export type DependTypes = keyof DependOptions;

export const viteDepends = {
  jessibuca: runJessibucaScript,
  cesium: runCesiumScript,
  tianditu: runTiandituScript,
  easyplayer: runElementScript,
};

export default viteDepends;
