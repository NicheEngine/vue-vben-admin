import { runCesiumScript } from './cesium';
import { runEasyplayerScript } from './easyplayer';
import { runJessibucaScript } from './jessibuca';
import { runTiandituScript } from './tianditu';

export interface DependConfigOptions {
  source?: string;
  target?: string;
}

export const DEPEND_KEYS = [
  'cesium',
  'tianditu',
  'jessibuca',
  'easyplayer',
] as const;

export type DependTypes = (typeof DEPEND_KEYS)[number];

export type DependOptions = {
  [K in DependTypes]?: boolean | DependConfigOptions;
};

export const viteDepends: Record<
  DependTypes,
  (options?: boolean | DependConfigOptions) => void
> = {
  jessibuca: runJessibucaScript,
  cesium: runCesiumScript,
  tianditu: runTiandituScript,
  easyplayer: runEasyplayerScript,
};

export default viteDepends;
