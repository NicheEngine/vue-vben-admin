import type {
  AxiosInstance,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import type { AxiosHandler } from './AxiosHandler';
import type {
  AxiosAuthTokenOptions,
  AxiosHttpConfigOptions,
  AxiosHttpRequestConfig,
  AxiosHttpRequestOptions,
  AxiosHttpResult,
  AxiosHttpRetryOptions,
  AxiosResultOptions,
} from './types';

import { $locale, $t } from '@vben/locales';
import { cloneDeep, isFunction, isObject, isString, merge } from '@vben/utils';

import AxiosObject from './AxiosObject';
import AxiosRetry from './AxiosRetry';

function urlParams(baseUrl: string, obj: any): string {
  let parameters = '';
  for (const key in obj) {
    parameters += `${key}=${encodeURIComponent(obj[key])}&`;
  }
  parameters = parameters.replace(/&$/, '');
  if (!parameters) {
    return baseUrl;
  }
  return baseUrl.includes('?')
    ? `${baseUrl}&${parameters}`
    : baseUrl.replace(/\/?$/, '?') + parameters;
}

function joinTimestamp(
  join: boolean,
  timeSign: string,
  restful = false,
): object | string {
  if (!join) {
    return restful ? '' : {};
  }
  const now = Date.now();
  if (restful) {
    return `?${timeSign}=${now}`;
  }
  return { [timeSign]: now };
}

function formatRequestDate(params: Record<string, any>, seen = new WeakSet()) {
  if (Object.prototype.toString.call(params) !== '[object Object]') {
    return;
  }
  if (seen.has(params)) {
    return;
  }
  seen.add(params);

  for (const key in params) {
    const format = params[key]?.format ?? null;
    if (format && typeof format === 'function') {
      params[key] = params[key].format('YYYY-MM-DD HH:mm:ss');
    }
    if (isString(key)) {
      const value = params[key];
      if (value) {
        try {
          params[key] = isString(value) ? value.trim() : value;
        } catch (error: any) {
          throw new Error(error, { cause: error });
        }
      }
    }
    if (isObject(params[key])) {
      formatRequestDate(params[key], seen);
    }
  }
}

const authTokenHandler = async (axiosObject: AxiosObject, error: any) => {
  const axiosConfig = axiosObject.axiosConfig();
  const { config } = error;
  if (!config) {
    throw error;
  }

  const flushQueue = (token: string) => {
    const queue = axiosObject.refreshTokenQueue;
    axiosObject.refreshTokenQueue = [];
    queue.forEach((callback) => callback(token));
  };

  const handleRefreshFailure = async (err: unknown) => {
    flushQueue('');
    console.error('Refresh token failed, please login again.');
    await authenticate();
    throw err;
  };

  const {
    authenticate = () => Promise.resolve(),
    refreshToken = () => Promise.resolve(''),
    tokenPrefix,
    isRefreshToken,
  } = axiosConfig?.authToken || {};

  if (!isRefreshToken || config.__isRetryRequest) {
    await authenticate();
    throw error;
  }

  if (axiosObject.isRefreshing) {
    return new Promise((resolve, reject) => {
      axiosObject.refreshTokenQueue.push((currentToken: string) => {
        if (!currentToken) {
          reject(error);
          return;
        }
        if (!config.headers) {
          config.headers = {};
        }
        config.headers.Authorization = tokenPrefix
          ? `${tokenPrefix} ${currentToken}`
          : currentToken;
        resolve(axiosObject.request(config));
      });
    });
  }

  axiosObject.isRefreshing = true;
  config.__isRetryRequest = true;

  try {
    const newToken = (await refreshToken()) || '';
    if (!newToken) {
      return await handleRefreshFailure(
        new Error('refreshToken returned empty'),
      );
    }
    flushQueue(newToken);
    return axiosObject.request({ ...config });
  } catch (refreshError) {
    return await handleRefreshFailure(refreshError);
  } finally {
    axiosObject.isRefreshing = false;
  }
};

const handler: AxiosHandler = {
  beforeResponseHandler: (
    config: AxiosHttpRequestConfig,
    options: AxiosHttpRequestOptions,
    response: AxiosResponse<AxiosHttpResult>,
  ) => {
    const isNativeResponse = config?.options?.isNativeResponse;
    const resultType = options.resultType;
    if (isNativeResponse || resultType === 'raw') {
      return response;
    }
    const { config: client, data: result } = response;
    const useResponse = options.useResponse;
    if (useResponse || resultType === 'body') {
      return result;
    }
    const {
      statusField = 'status',
      dataField = 'data',
      successStatus = [0, 200],
    } = config.result || {};
    const resultStatus: never =
      (result[statusField] as never) ||
      (result.status as never) ||
      (result.code as never);
    if (
      isFunction(successStatus)
        ? successStatus(resultStatus)
        : successStatus.includes(resultStatus)
    ) {
      return isFunction(dataField) ? dataField(result) : result[dataField];
    }
    throw Object.assign({}, { config: client || config, response });
  },

  beforeRequestHandler: (
    config: AxiosHttpRequestConfig,
    options: AxiosHttpRequestOptions,
  ) => {
    const configOptions: AxiosHttpConfigOptions = config.options || {};
    const {
      apiUrl,
      joinPrefix,
      joinParamsToUrl,
      formatDate,
      joinTime = true,
      timeSign = '_t',
      urlPrefix = '',
    } = configOptions;
    if (joinPrefix && urlPrefix) {
      options.url = `${urlPrefix}${options.url}`;
    }

    if (apiUrl && isString(apiUrl)) {
      options.url = `${apiUrl}${options.url}`;
    }
    const params = options.params || {};
    const data = options.data || false;
    formatDate && data && !isString(data) && formatRequestDate(data);
    if (options.method?.toUpperCase() === 'GET') {
      if (isString(params)) {
        options.url = `${options.url + params}${joinTimestamp(joinTime, timeSign, true)}`;
        options.params = undefined;
      } else {
        options.params = Object.assign(
          params || {},
          joinTimestamp(joinTime, timeSign, false),
        );
      }
    } else {
      if (isString(params)) {
        options.url = `${options.url + params}${joinTimestamp(joinTime, timeSign, true)}`;
        options.params = undefined;
      } else {
        options.params = Object.assign(
          params || {},
          joinTimestamp(joinTime, timeSign, false),
        );
        formatDate && formatRequestDate(params);
        if (
          options.data !== undefined &&
          options.data !== null &&
          (Object.keys(options.data).length > 0 ||
            options.data instanceof FormData)
        ) {
          options.data = data;
          options.params = params;
        } else {
          options.data = params;
          options.params = undefined;
        }
        if (joinParamsToUrl) {
          options.url = urlParams(
            options.url as string,
            Object.assign({}, options.params, options.data),
          );
        }
      }
    }
    return options;
  },

  doRequestHandler: (
    config: AxiosHttpRequestConfig,
    options: InternalAxiosRequestConfig,
  ) => {
    const { tokenPrefix, accessToken = () => '' } = config?.authToken || {};
    const currentToken = accessToken();
    if (currentToken && config?.options?.withToken !== false) {
      if (!options.headers) {
        options.headers = {} as AxiosRequestHeaders;
      }
      options.headers.Authorization = tokenPrefix
        ? `${tokenPrefix} ${currentToken}`
        : currentToken;
    }
    if (!options.headers) {
      options.headers = {} as AxiosRequestHeaders;
    }
    options.headers['Accept-Language'] = $locale.value;
    return options as InternalAxiosRequestConfig;
  },

  afterRequestErrorHandler: async (axiosObject: AxiosObject, error: any) => {
    const { config, response } = error;
    const { unauthorizedStatus = [401] } = config?.authToken || {};

    if (!config || !response) {
      throw error;
    }

    const { messageHandler = () => {} } = config?.result || {};

    const status = response?.status || 500;
    if (unauthorizedStatus.includes(status)) {
      return await authTokenHandler(axiosObject, error);
    }
    const messageError: string = error?.toString?.() ?? '';
    let message = '';
    if (messageError?.includes('Network Error')) {
      message = $t('ui.fallback.http.networkError');
    } else if (error?.message?.includes?.('timeout')) {
      message = $t('ui.fallback.http.requestTimeout');
    }

    if (message && messageHandler) {
      messageHandler(message, error);
      throw error;
    }

    switch (status) {
      case 400: {
        message = $t('ui.fallback.http.badRequest');
        break;
      }
      case 401: {
        message = $t('ui.fallback.http.unauthorized');
        break;
      }
      case 403: {
        message = $t('ui.fallback.http.forbidden');
        break;
      }
      case 404: {
        message = $t('ui.fallback.http.notFound');
        break;
      }
      case 408: {
        message = $t('ui.fallback.http.requestTimeout');
        break;
      }
      default: {
        message = $t('ui.fallback.http.internalServerError');
      }
    }
    if (message && messageHandler) {
      messageHandler(message, error);
    }
    throw error;
  },

  afterResponseErrorHandler: async (
    axiosObject: AxiosObject,
    axiosInstance: AxiosInstance,
    error: any,
  ) => {
    const axiosConfig = axiosObject.axiosConfig();
    const { config, response } = error;
    const { unauthorizedStatus = [401] } = axiosConfig?.authToken || {};

    if (!config || !response) {
      throw error;
    }

    const { messageHandler = () => {} } = axiosConfig?.result || {};

    const status = response?.status || 500;
    if (unauthorizedStatus.includes(status)) {
      return await authTokenHandler(axiosObject, error);
    }

    const axiosRetry = new AxiosRetry();
    const { isRetry = true } = axiosConfig.httpRetry || {};
    if (config?.method?.toUpperCase() === 'GET' && isRetry) {
      return await axiosRetry.retry(axiosInstance, axiosConfig, error);
    }
    const message = response?.data?.message || response?.message || '';
    if (message && messageHandler) {
      messageHandler(message, error);
    }
    throw error;
  },
};

function createAxios(config?: Partial<AxiosHttpRequestConfig>) {
  return new AxiosObject(
    merge(
      (config || {}) as AxiosHttpRequestConfig,
      {
        timeout: 10 * 1000,
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        handler: cloneDeep(handler),
        authToken: {
          tokenPrefix: 'Bearer',
          accessToken: () => '',
          authenticate: () => Promise.resolve(),
          refreshToken: () => Promise.resolve(''),
          isRefreshToken: false,
          unauthorizedStatus: [401],
        } as AxiosAuthTokenOptions,
        httpRetry: {
          isRetry: true,
          count: 3,
          waitTime: 100,
        } as AxiosHttpRetryOptions,
        result: {
          dataField: 'data',
          statusField: 'status',
          successStatus: [0, 200],
        } as AxiosResultOptions,
        options: {
          joinPrefix: true,
          isNativeResponse: false,
          isTransformResponse: true,
          joinParamsToUrl: false,
          formatDate: true,
          joinTime: true,
          timeSign: '_t',
          ignoreCancelToken: true,
          withToken: true,
        } as AxiosHttpConfigOptions,
      } as AxiosHttpRequestConfig,
    ),
  );
}

export { createAxios };

export * from './AxiosCanceler';
export * from './AxiosHandler';
export * from './AxiosObject';
export * from './AxiosRetry';
export type * from './types';
