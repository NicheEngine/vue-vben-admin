import type { AxiosRequestConfig, CreateAxiosDefaults } from 'axios';

import type { AxiosHandler } from './AxiosHandler';

type AxiosParamsSerializer = 'brackets' | 'comma' | 'indices' | 'repeat';

type AxiosSerializeOptions<T = any> =
  | AxiosParamsSerializer
  | AxiosRequestConfig<T>['paramsSerializer'];

type AxiosHttpRetryOptions = {
  count: number;
  isRetry: boolean;
  waitTime: number;
};

type AxiosHttpConfigOptions = {
  apiUrl?: string;
  formatDate?: boolean;
  ignoreCancelToken?: boolean;
  isNativeResponse?: boolean;
  isTransformResponse?: boolean;
  joinParamsToUrl?: boolean;
  joinPrefix?: boolean;
  joinTime?: boolean;
  timeSign?: string;
  tokenPrefix?: string;
  urlPrefix?: string;
  withToken?: boolean;
};

type AxiosResultOptions = {
  dataField: ((response: any) => any) | string;
  errorLog?: boolean;
  messageHandler?: (message: string, error: any) => void;
  statusField: string;
  successStatus: ((status: any) => boolean) | number[] | string[];
};

type AxiosAuthTokenOptions = {
  accessToken?: () => string;
  authenticate?: () => Promise<void>;
  isRefreshToken?: boolean;
  refreshToken?: () => Promise<string>;
  tokenPrefix?: string;
  unauthorizedStatus?: number[];
};

interface AxiosHttpRequestOptions<T = any> extends AxiosRequestConfig<T> {
  resultType?: 'body' | 'raw';
  serializer?: AxiosParamsSerializer;
  useResponse?: boolean;
}

interface AxiosHttpRequestConfig<D = any> extends CreateAxiosDefaults<D> {
  handler?: AxiosHandler;
  options?: AxiosHttpConfigOptions;
  serializer?: AxiosSerializeOptions;
  result?: AxiosResultOptions;
  authToken?: AxiosAuthTokenOptions;
  httpRetry?: AxiosHttpRetryOptions;
}

type AxiosHttpDataRecord<T = any> = Record<string, T>;

type AxiosHttpMultifile = {
  [key: string]: any;
  data?: AxiosHttpDataRecord;
  file: Blob | File;
  filename?: string;
  name?: string;
};

type AxiosHttpResult<T = any> = {
  [key: string]: any;
  code?: number;
  data: T;
  message: string;
  status?: number;
};

export type {
  AxiosAuthTokenOptions,
  AxiosHttpConfigOptions,
  AxiosHttpDataRecord,
  AxiosHttpMultifile,
  AxiosHttpRequestConfig,
  AxiosHttpRequestOptions,
  AxiosHttpResult,
  AxiosHttpRetryOptions,
  AxiosParamsSerializer,
  AxiosResultOptions,
  AxiosSerializeOptions,
};
