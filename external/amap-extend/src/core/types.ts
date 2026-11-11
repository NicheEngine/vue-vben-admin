import type { Ref } from 'vue';

/** 坐标点 [经度, 纬度] */
export type Point = [number, number];

/** 覆盖物类型 */
export type OverlayType = 'circle' | 'marker' | 'polygon' | 'polyline';

/** 结构化覆盖物记录 */
export interface OverlayRecord<T = any> {
  id: string;
  type: OverlayType;
  instance: T;
}

/** 地图事件名 */
export type AmapEventType =
  | 'click'
  | 'dblclick'
  | 'dragend'
  | 'mousemove'
  | 'moveend'
  | 'zoomchange';

/** 地图事件回调 */
export type AmapEventHandler = (e: any) => void;

/**
 * 基础地图状态。
 *
 * 注意：这里刻意不声明 `kind`，由 `Amap2dState` / `Amap3dState` 各自收窄，
 * 避免 `IAmap2dApi extends IAmapCommonApi, Amap2dState` 时
 * `'2d' | '3d'` 与 `'2d'` 不兼容触发 TS2320。
 */
export interface AmapBaseState {
  isReady: Readonly<Ref<boolean>>;
  isLoading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<null | string>>;
  center: Readonly<Ref<Point>>;
  zoom: Readonly<Ref<number>>;
  mousePosition: Readonly<Ref<null | Point>>;
  currentAddress: Readonly<Ref<null | string>>;
  overlays: Readonly<Ref<OverlayRecord[]>>;
  activeLayers: Readonly<Ref<string[]>>;
}

/** 2D 状态：显式判别字段 `kind: '2d'` */
export interface Amap2dState extends AmapBaseState {
  /** 显式判别 2D，避免用 `'pitch' in api` 探测 */
  readonly kind: '2d';
}

/** 3D 状态：在基础状态上追加 pitch / rotation */
export interface Amap3dState extends AmapBaseState {
  /** 显式判别 3D */
  readonly kind: '3d';
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
  terrain?: boolean;
}

export interface DrawOptions {
  strokeColor?: string;
  strokeWeight?: number;
  fillColor?: string;
  fillOpacity?: number;
  [key: string]: any;
}

/**
 * 公共 API 能力（2D/3D 通用部分）。
 *
 * 不继承 `AmapBaseState`，也不声明 `kind` / `init`：
 * - `kind` 由 `Amap2dState` / `Amap3dState` 提供，避免多继承类型冲突；
 * - `init` 因 2D/3D 的 config 类型不同，由各子接口自行声明。
 *
 * 若某处只依赖公共能力，请使用 `IAmapCommonApi`；
 * 若需要读 `kind` 或调用 `init`，请使用 `IAmap2dApi | IAmap3dApi`。
 */
export interface IAmapCommonApi {
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

  /** 按 id 移除 */
  removeOverlayById(id: string): void;
  /** 移除任意 overlay 实例（兼容旧用法） */
  removeOverlay(overlay: any): void;
  clearOverlays(): void;
  getOverlaysByType(type: OverlayType): OverlayRecord[];

  startDraw(mode: OverlayType, options?: DrawOptions): void;
  stopDraw(): void;
  /** 监听「绘制完成」事件，返回取消函数 */
  onDraw(cb: (overlay: OverlayRecord) => void): () => void;

  searchPOI(
    keyword: string,
    options?: { pageIndex?: number; pageSize?: number },
  ): Promise<any[]>;
  reverseGeocode(position: Point): Promise<string>;
  triggerGeolocation(): Promise<Point>;

  /** 通用地图事件订阅，返回取消函数 */
  on(type: AmapEventType, handler: AmapEventHandler): () => void;
  off(type: AmapEventType, handler: AmapEventHandler): void;

  getMapInstance(): any;
}

export interface IAmap2dApi extends Amap2dState, IAmapCommonApi {
  init(container: HTMLElement | string, config?: Amap2dConfig): Promise<void>;
}

export interface IAmap3dApi extends Amap3dState, IAmapCommonApi {
  init(container: HTMLElement | string, config?: Amap3dConfig): Promise<void>;
  setPitch(pitch: number): void;
  setRotation(rotation: number): void;
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
