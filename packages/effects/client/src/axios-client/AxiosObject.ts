import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import type {
  AxiosHttpDataRecord,
  AxiosHttpMultifile,
  AxiosHttpRequestConfig,
  AxiosHttpRequestOptions,
  AxiosHttpResult,
  AxiosSerializeOptions,
} from './types';

import {
  bindMethods,
  cloneDeep,
  isFunction,
  isString,
  isUndefined,
} from '@vben/utils';

import axios from 'axios';
import qs from 'qs';

import AxiosCanceler from './AxiosCanceler';

const serializeParams = (serialize: AxiosSerializeOptions) => {
  if (isString(serialize)) {
    switch (serialize) {
      case 'brackets': {
        return (params: any) =>
          qs.stringify(params, { arrayFormat: 'brackets' });
      }
      case 'comma': {
        return (params: any) => qs.stringify(params, { arrayFormat: 'comma' });
      }
      case 'indices': {
        return (params: any) =>
          qs.stringify(params, { arrayFormat: 'indices' });
      }
      case 'repeat': {
        return (params: any) => qs.stringify(params, { arrayFormat: 'repeat' });
      }
    }
  }
  return serialize;
};

class AxiosObject {
  public isRefreshing = false;
  public refreshTokenQueue: ((token: string) => void)[] = [];
  private readonly config: AxiosHttpRequestConfig;
  private instance: AxiosInstance;

  constructor(config: AxiosHttpRequestConfig) {
    this.config = config;
    this.instance = axios.create(config);
    bindMethods(this);
    this.setupHttpInterceptor();
  }

  public axiosConfig(): AxiosHttpRequestConfig {
    return this.config;
  }

  public configAxios(config: AxiosHttpRequestConfig) {
    if (!this.instance) {
      return;
    }
    this.createAxios(config);
  }

  public delete<T = any>(options: AxiosHttpRequestOptions): Promise<T> {
    return this.request({ ...options, method: 'DELETE' });
  }

  public download<T = any>(options: AxiosHttpRequestOptions): Promise<T> {
    const axiosOptions = Object.assign(
      {
        resultType: 'body',
        responseType: 'blob',
      } as AxiosHttpRequestOptions,
      options,
    );
    return this.request({ ...axiosOptions, method: 'GET' });
  }

  public get<T = any>(options: AxiosHttpRequestOptions): Promise<T> {
    return this.request({ ...options, method: 'GET' });
  }

  public getInstance(): AxiosInstance {
    return this.instance;
  }

  public patch<T = any>(options: AxiosHttpRequestOptions): Promise<T> {
    return this.request({ ...options, method: 'PATCH' });
  }

  public post<T = any>(options: AxiosHttpRequestOptions): Promise<T> {
    return this.request({ ...options, method: 'POST' });
  }

  public put<T = any>(options: AxiosHttpRequestOptions): Promise<T> {
    return this.request({ ...options, method: 'PUT' });
  }

  public request<T>(options: AxiosHttpRequestOptions): Promise<T> {
    let axiosOptions: AxiosHttpRequestOptions = cloneDeep(options);
    const configHandler = this.config.handler;
    const configParamsSerializer = this.config.serializer
      ? { paramsSerializer: serializeParams(this.config.serializer) }
      : {};
    const defaultParamsSerializer = axiosOptions.serializer
      ? { paramsSerializer: serializeParams(axiosOptions.serializer) }
      : configParamsSerializer;
    const optionParamsSerializer = axiosOptions.paramsSerializer
      ? { paramsSerializer: axiosOptions.paramsSerializer }
      : defaultParamsSerializer;

    axiosOptions = Object.assign(axiosOptions, optionParamsSerializer);
    const {
      afterRequestErrorHandler,
      afterResponseErrorHandler,
      beforeRequestHandler,
      beforeResponseHandler,
    } = configHandler || {};

    if (beforeRequestHandler && isFunction(beforeRequestHandler)) {
      axiosOptions = beforeRequestHandler(this.config, axiosOptions);
    }

    axiosOptions = this.supportFormData(axiosOptions);

    return new Promise<T>((resolve, reject) => {
      this.instance
        .request<any, AxiosResponse<AxiosHttpResult>>(axiosOptions)
        .then((response: AxiosResponse<AxiosHttpResult>) => {
          if (beforeResponseHandler && isFunction(beforeResponseHandler)) {
            try {
              const result = beforeResponseHandler(
                this.config,
                axiosOptions,
                response,
              );
              resolve(result);
              return;
            } catch (error: any) {
              if (
                afterResponseErrorHandler &&
                isFunction(afterResponseErrorHandler)
              ) {
                afterResponseErrorHandler(this, this.instance, error)
                  .then((result: any) => resolve(result))
                  .catch((error: any) => reject(error));
                return;
              }
              reject(error);
              return;
            }
          }
          resolve(response.data as unknown as T);
        })
        .catch(async (error: any) => {
          if (
            afterRequestErrorHandler &&
            isFunction(afterRequestErrorHandler)
          ) {
            try {
              const result = await afterRequestErrorHandler(this, error);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(error);
          }
        });
    });
  }

  public setHeaders(headers: any): void {
    if (!this.instance) {
      return;
    }
    Object.assign(this.instance.defaults.headers, headers);
  }

  public upload<T = any>(
    config: AxiosHttpRequestOptions,
    params: AxiosHttpMultifile,
  ) {
    const formData = new window.FormData();
    const customFilename = params.name || 'file';

    if (params.filename) {
      formData.append(customFilename, params.file, params.filename);
    } else {
      formData.append(customFilename, params.file);
    }
    const fileData = params.data as AxiosHttpDataRecord;
    if (fileData) {
      Object.keys(fileData).forEach((key) => {
        const value = fileData?.[key];
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            !isUndefined(item) && formData.append(`${key}[${index}]`, item);
          });
        } else {
          !isUndefined(value) && formData.append(key, value);
        }
      });
    }

    return this.instance.request<T>({
      ...config,
      method: 'POST',
      data: formData,
      headers: {
        'Content-type': 'multipart/form-data;charset=utf-8',
        ignoreCancelToken: true,
        ...config?.headers,
      },
    });
  }

  private createAxios(config: AxiosHttpRequestConfig): void {
    this.instance = axios.create(config);
  }

  private setupHttpInterceptor() {
    const axiosHandler = this.config.handler;
    if (!axiosHandler) {
      return;
    }
    const {
      afterResponseErrorHandler,
      doRequestErrorHandler,
      doRequestHandler,
      doResponseHandler,
    } = axiosHandler;

    const axiosCanceler = AxiosCanceler.default();

    this.instance.interceptors.request.use(
      (options: InternalAxiosRequestConfig) => {
        const axiosConfig = options as AxiosHttpRequestConfig;
        const ignoreCancelToken = axiosConfig.options?.ignoreCancelToken;
        const ignoreCancel =
          ignoreCancelToken === undefined
            ? this.config.options?.ignoreCancelToken
            : ignoreCancelToken;

        !ignoreCancel && axiosCanceler.cache(options);
        if (doRequestHandler && isFunction(doRequestHandler)) {
          options = doRequestHandler(this.config, options);
        }
        return options;
      },
      undefined,
    );

    doRequestErrorHandler &&
      isFunction(doRequestErrorHandler) &&
      this.instance.interceptors.request.use(undefined, doRequestErrorHandler);

    this.instance.interceptors.response.use((response: AxiosResponse) => {
      response && axiosCanceler.remove(response.config);
      if (doResponseHandler && isFunction(doResponseHandler)) {
        response = doResponseHandler(this.config, response);
      }
      return response;
    }, undefined);

    afterResponseErrorHandler &&
      isFunction(afterResponseErrorHandler) &&
      this.instance.interceptors.response.use(undefined, (error) => {
        return afterResponseErrorHandler(this, this.instance, error);
      });
  }

  private supportFormData(options: AxiosHttpRequestOptions) {
    const headers = (options?.headers || this.config?.headers) as any;
    const contentType = headers?.['Content-Type'] || headers?.['content-type'];
    if (
      contentType !== 'application/x-www-form-urlencoded;charset=utf-8' ||
      options.data === undefined ||
      options.method?.toUpperCase() === 'GET'
    ) {
      return options;
    }

    return {
      ...options,
      data: qs.stringify(options.data, { arrayFormat: 'brackets' }),
    };
  }
}

export default AxiosObject;
