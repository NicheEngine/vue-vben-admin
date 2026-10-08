import type { AxiosInstance } from 'axios';

import type { AxiosHttpRequestConfig } from './types';

export class AxiosRetry {
  async retry(
    instance: AxiosInstance,
    axiosConfig: AxiosHttpRequestConfig,
    error: any,
  ) {
    const { config } = error;
    const httpRetry = axiosConfig?.httpRetry;
    const waitTime = httpRetry?.waitTime ?? 0;
    const count = httpRetry?.count ?? 0;

    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= count) {
      throw error;
    }
    config.__retryCount += 1;

    // 指数退避：第 n 次重试等待 waitTime * 2^(n-1)
    const delayTime = waitTime * 2 ** (config.__retryCount - 1);
    return this.delay(delayTime).then(() => instance(config));
  }

  private delay(waitTime: number) {
    return new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

export default AxiosRetry;
