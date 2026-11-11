import type { DrawOptions, OverlayType } from './types';

export class AmapPluginManager {
  private AMap: any = null;
  private drawListeners = new Set<(overlay: any) => void>();
  private geocoder: any = null;
  private mapInstance: any = null;
  private mouseTool: any = null;
  private placeSearch: any = null;
  private searchListeners = new Set<(overlay: any) => void>();

  public destroy() {
    this.mouseTool?.close(true);
    this.mouseTool = null;
    this.geocoder = null;
    this.placeSearch = null;
    this.mapInstance = null;
    this.AMap = null;
    this.drawListeners.clear();
    this.searchListeners.clear();
  }

  public init(AMap: any, mapInstance: any) {
    this.AMap = AMap;
    this.mapInstance = mapInstance;
  }

  /** 绘制完成事件订阅 */
  public onDraw(cb: (overlay: any) => void): () => void {
    this.drawListeners.add(cb);
    return () => this.drawListeners.delete(cb);
  }

  public async reverseGeocode(position: [number, number]): Promise<string> {
    this.ensureReady();
    if (!this.geocoder) {
      this.geocoder = new this.AMap.Geocoder({
        radius: 1000,
        extensions: 'all',
      });
    }
    return new Promise((resolve, reject) => {
      this.geocoder.getAddress(position, (status: string, result: any) => {
        if (status === 'complete' && result.regeocode) {
          resolve(result.regeocode.formattedAddress);
        } else {
          reject(new Error('逆地理编码失败'));
        }
      });
    });
  }

  public async searchPOI(
    keyword: string,
    options?: { pageIndex?: number; pageSize?: number },
  ): Promise<any[]> {
    this.ensureReady();
    if (!this.placeSearch) {
      // 不在构造时写死分页，交给每次 search 覆盖
      this.placeSearch = new this.AMap.PlaceSearch({ citylimit: false });
    }
    const pageIndex = options?.pageIndex ?? 1;
    const pageSize = options?.pageSize ?? 20;
    return new Promise((resolve, reject) => {
      this.placeSearch.search(
        keyword,
        (status: string, result: any) => {
          if (status === 'complete' && result.poiList) {
            resolve(result.poiList.pois ?? []);
          } else if (status === 'no_data') {
            resolve([]);
          } else {
            reject(new Error(`POI 搜索失败：${status}`));
          }
        },
        { pageIndex, pageSize },
      );
    });
  }

  public startDraw(mode: OverlayType, options?: DrawOptions) {
    this.ensureReady();
    if (!this.mouseTool) {
      this.mouseTool = new this.AMap.MouseTool(this.mapInstance);
      this.mouseTool.on('draw', (e: any) => {
        // 🔥 绘制完成后广播给所有订阅者
        this.drawListeners.forEach((fn) => fn(e.obj));
      });
    }
    this.mouseTool.close(false);

    const styleOptions = options
      ? {
          strokeColor: options.strokeColor,
          strokeWeight: options.strokeWeight,
          fillColor: options.fillColor,
          fillOpacity: options.fillOpacity,
        }
      : undefined;

    switch (mode) {
      case 'circle': {
        this.mouseTool.circle(styleOptions);
        break;
      }
      case 'marker': {
        this.mouseTool.marker(styleOptions);
        break;
      }
      case 'polygon': {
        this.mouseTool.polygon(styleOptions);
        break;
      }
      case 'polyline': {
        this.mouseTool.polyline(styleOptions);
        break;
      }
    }
  }

  public stopDraw() {
    this.mouseTool?.close(true);
  }

  private ensureReady() {
    if (!this.AMap || !this.mapInstance) {
      throw new Error(
        '[AmapPluginManager] 未初始化，请先调用 init(AMap, mapInstance)',
      );
    }
  }
}
