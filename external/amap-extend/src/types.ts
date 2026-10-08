import type { Point } from '@vben/types';

export interface AMapLoadConfig {
  AMapUI?: {
    plugins?: string[];
    version?: string;
  };
  key: string;
  Loca?: {
    version?: string;
  };
  plugins?: string[];
  version: string;
}

export type AMap = any;
export type AMapLoadingPromise = null | Promise<AMap>;

export interface AMapSetupOptions {
  loadConfig?: AMapLoadConfig;
  securityCode?: string;
}

export interface AMap2dContext {
  amap: any;
  mouseTool: any;
}

export interface AMap3dContext extends AMap2dContext {
  control: any;
}

export interface AMap2dConfig {
  center: Point;
  zoom: number;
  layers?: any[];
  viewMode?: '2D' | '3D';
  [key: string]: any; // AMap 配置项很多，允许扩展
}

export interface AMap3dConfig extends AMap2dConfig {
  pitch: number;
  rotation: number;
  terrain: boolean;
}

export interface AMap3dOptions {
  callback?: CallableFunction;
  config?: AMap3dConfig;
  container: string;
  control?: boolean;
  mouseTool?: boolean;
  satellite?: boolean;
}

export interface AMap2dOptions {
  callback?: CallableFunction;
  config?: AMap2dConfig;
  container: string;
  mouseTool?: boolean;
  satellite?: boolean;
}
