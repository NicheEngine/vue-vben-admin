import type { AxiosRequestConfig, Canceler } from 'axios';

import axios from 'axios';
import qs from 'qs';

export class AxiosCanceler {
  private static instance: AxiosCanceler;
  private static PENDING_CACHE = new Map<string, Canceler>();

  static cache(config: AxiosRequestConfig) {
    this.remove(config);
    const url = AxiosCanceler.joinUrl(config);
    config.cancelToken =
      config.cancelToken ||
      new axios.CancelToken((cancel) => {
        if (!AxiosCanceler.PENDING_CACHE.has(url)) {
          AxiosCanceler.PENDING_CACHE.set(url, cancel);
        }
      });
  }

  static default(): AxiosCanceler {
    if (AxiosCanceler.instance) {
      return AxiosCanceler.instance;
    }
    AxiosCanceler.instance = new AxiosCanceler();
    return AxiosCanceler.instance;
  }

  static remove(config: AxiosRequestConfig) {
    const url = AxiosCanceler.joinUrl(config);
    if (AxiosCanceler.PENDING_CACHE.has(url)) {
      const cancel = AxiosCanceler.PENDING_CACHE.get(url);
      cancel?.(url);
      AxiosCanceler.PENDING_CACHE.delete(url);
    }
  }

  static removeAll() {
    AxiosCanceler.PENDING_CACHE.forEach((cancel) => {
      cancel?.();
    });
    AxiosCanceler.PENDING_CACHE.clear();
  }

  static reset(): void {
    AxiosCanceler.PENDING_CACHE = new Map<string, Canceler>();
  }

  private static joinUrl(config: AxiosRequestConfig): string {
    const params = config.params ? qs.stringify(config.params) : '';
    const data =
      config.data && typeof config.data !== 'string'
        ? JSON.stringify(config.data)
        : '';
    return [config.method, config.url, params, data].filter(Boolean).join('&');
  }

  // ---- 实例方法：直接委托静态方法，保持向后兼容 ----
  cache(config: AxiosRequestConfig) {
    AxiosCanceler.cache(config);
  }

  remove(config: AxiosRequestConfig) {
    AxiosCanceler.remove(config);
  }

  removeAll() {
    AxiosCanceler.removeAll();
  }

  reset(): void {
    AxiosCanceler.reset();
  }
}

export default AxiosCanceler;
