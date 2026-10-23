import type { Ref } from 'vue';

import type { OssrsPlayerApi } from './ossrs-player-api';

export interface OssrsPlayerProps {
  url?: string;
  class?: string;
  protocol?: 'rtc' | 'whep';
  autoPlay?: boolean;
  muted?: boolean;
  api?: OssrsPlayerApi;
}

/** 组件内部透传用（去掉 api，由 useOssrsPlayer 注入） */
export type OssrsPlayerInnerProps = Omit<OssrsPlayerProps, 'api'>;

export interface OssrsPlayerState {
  url: string;
  autoplay: boolean;
  muted: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: null | string;
  volume: number;
  currentTime: number;
  videoWidth: number;
  videoHeight: number;
}

export interface OssrsCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: Error | string) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onReady?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export interface OssrsApiOptions extends OssrsCallbacks {
  initialUrl?: string;
  initialProtocol?: 'rtc' | 'whep';
  initialState?: Partial<OssrsPlayerState>;
}

export type ExtendedOssrsPlayerApi = OssrsPlayerApi & {
  useSelector: <T = OssrsPlayerState>(
    selector?: (state: OssrsPlayerState) => T,
  ) => Readonly<Ref<T>>;
};
