export class AmapPluginManager {
  private AMap: any = null;
  private geocoder: any = null;
  private mapInstance: any = null;
  private mouseTool: any = null;
  private placeSearch: any = null;

  /** 销毁插件，解除所有引用 */
  public destroy() {
    this.mouseTool?.close(true);
    this.mouseTool = null;
    this.geocoder = null;
    this.placeSearch = null;
    this.mapInstance = null;
    this.AMap = null; // 关键：解除对全局 AMap 的引用
  }

  /** 注入 AMap 全局对象和地图实例 */
  public init(AMap: any, mapInstance: any) {
    this.AMap = AMap;
    this.mapInstance = mapInstance;
  }

  /** 逆地理编码（坐标转地址） */
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

  /** POI 搜索 */
  public async searchPOI(keyword: string): Promise<any[]> {
    this.ensureReady();
    if (!this.placeSearch) {
      this.placeSearch = new this.AMap.PlaceSearch({
        pageSize: 20,
        pageIndex: 1,
        citylimit: false,
      });
    }
    return new Promise((resolve) => {
      this.placeSearch.search(keyword, (status: string, result: any) => {
        if (status === 'complete' && result.poiList) {
          resolve(result.poiList.pois);
        } else {
          resolve([]);
        }
      });
    });
  }

  /** 开启绘制模式 */
  public startDraw(mode: 'circle' | 'marker' | 'polygon' | 'polyline') {
    this.ensureReady();
    if (!this.mouseTool) {
      this.mouseTool = new this.AMap.MouseTool(this.mapInstance);
    }
    this.mouseTool.close(false); // 先关闭旧的绘制状态

    switch (mode) {
      case 'circle': {
        this.mouseTool.circle();
        break;
      }
      case 'marker': {
        this.mouseTool.marker();
        break;
      }
      case 'polygon': {
        this.mouseTool.polygon();
        break;
      }
      case 'polyline': {
        this.mouseTool.polyline();
        break;
      }
    }
  }

  /** 停止绘制模式 */
  public stopDraw() {
    this.mouseTool?.close(true);
  }

  /** 内部校验，确保已正确初始化 */
  private ensureReady() {
    if (!this.AMap || !this.mapInstance) {
      throw new Error(
        '[AmapPluginManager] 未初始化，请先调用 init(AMap, mapInstance)',
      );
    }
  }
}
