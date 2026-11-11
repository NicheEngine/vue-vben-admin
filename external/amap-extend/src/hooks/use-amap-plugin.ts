import { ref } from 'vue';

import { useLoadAMap } from '../core/loader';

/**
 * 高德地图插件加载 Hook。
 *
 * 提供异步加载和高德插件加载能力，并缓存已加载的插件。
 *
 * @example
 * ```ts
 * const { loadPlugin } = useAmapPlugin();
 * const DistrictSearch = await loadPlugin('AMap.DistrictSearch');
 * const search = new DistrictSearch();
 * ```
 */
export function useAmapPlugin() {
  const isLoading = ref(false);
  const error = ref<null | string>(null);

  /** 已加载的插件缓存，避免重复请求 */
  const loadedPlugins = new Map<string, any>();

  /** 从命名空间中安全按路径取值，例如 "Loca.HeatMap" 会取 AMap.Loca.HeatMap */
  function getByPath(obj: any, path: string): any {
    const keys = path.split('.');
    let current: any = obj;
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  }

  /**
   * 按需异步加载高德插件。
   * @param pluginName 高德插件名称，如 'AMap.DistrictSearch'
   * @returns 插件类或实例（视插件而定）
   */
  const loadPlugin = async (pluginName: string): Promise<any> => {
    if (loadedPlugins.has(pluginName)) {
      return loadedPlugins.get(pluginName);
    }

    isLoading.value = true;
    error.value = null;

    try {
      const AMap = await useLoadAMap();

      return new Promise((resolve, reject) => {
        AMap.plugin([pluginName], () => {
          // 去掉开头的 "AMap."，转成路径
          const path = pluginName.replace(/^AMap\./, '');
          const PluginClass = getByPath(AMap, path);
          if (!PluginClass) {
            reject(new Error(`[AmapPlugin] 插件加载失败：${pluginName}`));
            return;
          }
          loadedPlugins.set(pluginName, PluginClass);
          resolve(PluginClass);
        });
      });
    } catch (error_: any) {
      error.value = error_.message || '插件加载失败';
      throw error_;
    } finally {
      isLoading.value = false;
    }
  };
  /** 批量加载多个插件 */
  const loadPlugins = async (pluginNames: string[]): Promise<any[]> => {
    return Promise.all(pluginNames.map((name) => loadPlugin(name)));
  };

  /** 清空缓存（一般不用） */
  const clearCache = () => {
    loadedPlugins.clear();
  };

  return {
    isLoading,
    error,
    loadPlugin,
    loadPlugins,
    clearCache,
  };
}
