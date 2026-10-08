import { ref } from 'vue';

interface AreaNode {
  getSubFeatures: () => any[];
}

export const useAMapUiHook = () => {
  const districtExplorer = ref<any>();
  const parentGeojson = ref<any[]>([]);
  const areaGeojson = ref<any[]>([]);
  const regionGeojson = ref<any[]>([]);

  function initDistrictExplorer(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!window.AMapUI) {
        reject(
          new Error(
            'The `AMapUI` is unloaded, please check the `AMap` related configuration.',
          ),
        );
        return;
      }
      window.AMapUI.loadUI(
        ['geo/DistrictExplorer'],
        (DistrictExplorer: any) => {
          const instance = new DistrictExplorer();
          districtExplorer.value = instance;
          resolve(instance);
        },
      );
    });
  }

  /** 确保 districtExplorer 已就绪，未就绪则初始化 */
  async function ensureExplorer() {
    if (districtExplorer.value) return districtExplorer.value;
    return initDistrictExplorer();
  }

  async function matchArea(adcode: string) {
    const explorer = await ensureExplorer();
    const features = await new Promise<any[]>((resolve, reject) => {
      explorer.loadAreaNode(adcode, (error: string, areaNode: AreaNode) => {
        if (error) {
          reject(
            new Error(
              `The 'districtExplorer' load area nodes has error, ${error}`,
            ),
          );
          return;
        }
        resolve(areaNode.getSubFeatures());
      });
    });

    areaGeojson.value = features;
    if (features.length > 0) {
      parentGeojson.value = features;
      // 重置 region 结果，避免累积
      regionGeojson.value = [];
    } else if (parentGeojson.value.length > 0) {
      areaGeojson.value = parentGeojson.value.filter(
        (item: any) => item.properties.adcode === adcode,
      );
    }
  }

  function matchRegion(regions: string[]) {
    if (areaGeojson.value.length > 0) {
      const matched: any[] = [];
      for (const region of areaGeojson.value) {
        const province: string = region.properties.name;
        const simpleProvince = province.replaceAll(
          /省|市|自治区|壮族|回族|维吾尔|特别行政区/g,
          '',
        );
        if (regions.includes(simpleProvince)) {
          matched.push(region);
        }
      }
      regionGeojson.value = matched;
    } else {
      regionGeojson.value = areaGeojson.value;
    }
  }

  return {
    districtExplorer,
    matchArea,
    matchRegion,
    parentGeojson,
    areaGeojson,
    regionGeojson,
  };
};

export default useAMapUiHook;
