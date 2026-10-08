import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import type {
  AxiosHttpRequestConfig,
  AxiosHttpRequestOptions,
  AxiosHttpResult,
} from './types';

interface AxiosHandler {
  afterRequestErrorHandler?: (axiosObject: any, error: any) => Promise<any>;
  afterResponseErrorHandler?: (
    axiosObject: any,
    instance: AxiosInstance,
    error: any,
  ) => Promise<any>;
  beforeRequestHandler?: (
    config: AxiosHttpRequestConfig,
    options: AxiosHttpRequestOptions,
  ) => AxiosHttpRequestOptions;
  beforeResponseHandler?: (
    config: AxiosHttpRequestConfig,
    options: AxiosHttpRequestOptions,
    response: AxiosResponse<AxiosHttpResult>,
  ) => any;
  doRequestErrorHandler?: (error: Error) => void;
  doRequestHandler?: (
    config: AxiosHttpRequestConfig,
    options: InternalAxiosRequestConfig,
  ) => InternalAxiosRequestConfig;
  doResponseHandler?: (
    config: AxiosHttpRequestConfig<any>,
    response: AxiosResponse<any>,
  ) => AxiosResponse<any>;
}

export type { AxiosHandler };
