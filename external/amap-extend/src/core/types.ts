import type { Ref } from 'vue';

/** 坐标点 [经度, 纬度] */
export type Point = [number, number];

/** 基础地图状态 */
export interface AmapBaseState {
  isReady: Readonly<Ref<boolean>>;
  isLoading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<null | string>>;
  center: Readonly<Ref<Point>>;
  zoom: Readonly<Ref<number>>;
  mousePosition: Readonly<Ref<null | Point>>;
  currentAddress: Readonly<Ref<null | string>>;
  overlays: Readonly<Ref<any[]>>;
  activeLayers: Readonly<Ref<string[]>>;
}

export interface Amap3dState extends AmapBaseState {
  pitch: Readonly<Ref<number>>;
  rotation: Readonly<Ref<number>>;
}

export interface Amap2dConfig {
  center?: Point;
  zoom?: number;
  layers?: any[];
  viewMode?: '2D';
  [key: string]: any;
}

export interface Amap3dConfig extends Omit<Amap2dConfig, 'viewMode'> {
  pitch?: number;
  rotation?: number;
  viewMode?: '3D';
  terrain?: boolean; // 3D 专属
}

export interface IAmap2dApi extends AmapBaseState {
  init(container: HTMLElement | string, config?: Amap2dConfig): Promise<void>;
  destroy(): Promise<void>;
  setCenter(center: Point): void;
  setZoom(zoom: number): void;
  fitView(points: Point[]): void;
  setLayers(layerNames: string[]): void;
  setFeatures(features: string[]): void;

  addMarker(position: Point, options?: any): any;
  addCircle(center: Point, radius: number, options?: any): any;
  addPolygon(path: Point[], options?: any): any;
  addPolyline(path: Point[], options?: any): any;
  removeOverlay(overlay: any): void;
  clearOverlays(): void;

  startDraw(mode: 'circle' | 'marker' | 'polygon' | 'polyline'): void;
  stopDraw(): void;
  searchPOI(keyword: string): Promise<any[]>;
  reverseGeocode(position: Point): Promise<string>;
  triggerGeolocation(): Promise<Point>;

  getMapInstance(): any;
}

export interface IAmap3dApi extends Amap3dState {
  init(container: HTMLElement | string, config?: Amap3dConfig): Promise<void>;
  destroy(): Promise<void>;
  setCenter(center: Point): void;
  setZoom(zoom: number): void;
  setPitch(pitch: number): void;
  setRotation(rotation: number): void;
  fitView(points: Point[]): void;

  setLayers(layerNames: string[]): void;
  setFeatures(features: string[]): void;

  addMarker(position: Point, options?: any): any;
  addCircle(center: Point, radius: number, options?: any): any;
  addPolygon(path: Point[], options?: any): any;
  addPolyline(path: Point[], options?: any): any;
  removeOverlay(overlay: any): void;
  clearOverlays(): void;

  startDraw(mode: 'circle' | 'marker' | 'polygon' | 'polyline'): void;
  stopDraw(): void;
  searchPOI(keyword: string): Promise<any[]>;
  reverseGeocode(position: Point): Promise<string>;

  getMapInstance(): any;
}

export interface Amap2dOptions {
  container: HTMLElement | string;
  config?: Amap2dConfig;
  satellite?: boolean;
  mouseTool?: boolean;
  enableSearch?: boolean;
  callback?: () => void;
}

export interface Amap3dOptions extends Omit<Amap2dOptions, 'config'> {
  config?: Amap3dConfig;
  control?: boolean;
}
