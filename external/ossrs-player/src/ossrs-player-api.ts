import type { Store } from '@vben-core/shared/store';

import type { SrsRtcPlayer, SrsRtcPublisher, SrsRtcWhipWhep } from './sdk';
import type {
  OssrsApiOptions,
  OssrsCallbacks,
  OssrsPlayerState,
} from './types';

import { createStore } from '@vben-core/shared/store';
import { bindMethods } from '@vben-core/shared/utils';

import { SrsRtcPlayerAsync, SrsRtcWhipWhepAsync } from './sdk';

type AnyPlayer = SrsRtcPlayer | SrsRtcPublisher | SrsRtcWhipWhep;

export class OssrsPlayerApi {
  public store: Store<OssrsPlayerState>;

  public get video(): HTMLVideoElement | null {
    return this.videoElement;
  }

  private callbacks: OssrsCallbacks = {};
  private componentCallbacks: OssrsCallbacks = {};
  private loadTimeout: null | ReturnType<typeof setTimeout> = null;
  private player: AnyPlayer | null = null;
  private playStarted = false;
  private playToken = 0;
  private videoAbort: AbortController | null = null;
  private videoElement: HTMLVideoElement | null = null;

  constructor(options: OssrsApiOptions = {}) {
    const {
      onPlay,
      onPause,
      onError,
      onLoadStart,
      onLoadEnd,
      onReady,
      onTimeUpdate,
      initialState,
    } = options;

    this.callbacks = {
      onPlay,
      onPause,
      onError,
      onLoadStart,
      onLoadEnd,
      onReady,
      onTimeUpdate,
    };

    this.store = createStore<OssrsPlayerState>({
      url: '',
      autoplay: true,
      muted: true,
      isPlaying: false,
      isLoading: false,
      isReady: false,
      error: null,
      volume: 1,
      currentTime: 0,
      videoWidth: 0,
      videoHeight: 0,
      ...initialState,
    });

    bindMethods(this);
  }

  public bindVideoElement(video: HTMLVideoElement | null) {
    this.unbindVideoElement();
    this.videoElement = video;
    if (!video) return;

    this.videoAbort = new AbortController();
    const { signal } = this.videoAbort;

    video.addEventListener(
      'play',
      () => {
        this.store.setState((prev) => ({
          ...prev,
          isPlaying: true,
          isLoading: false,
          isReady: true,
        }));
        this.dispatch('onPlay');
      },
      { signal },
    );

    video.addEventListener(
      'pause',
      () => {
        this.store.setState((prev) => ({ ...prev, isPlaying: false }));
        this.dispatch('onPause');
      },
      { signal },
    );

    video.addEventListener(
      'volumechange',
      () => {
        this.store.setState((prev) => ({
          ...prev,
          volume: video.volume,
          muted: video.muted,
        }));
      },
      { signal },
    );

    video.addEventListener(
      'timeupdate',
      () => {
        this.store.setState((prev) => ({
          ...prev,
          currentTime: video.currentTime,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        }));
        this.dispatch('onTimeUpdate', video.currentTime);
      },
      { signal },
    );
  }

  public destroy() {
    this.destroyPlayer();
    this.unbindVideoElement();
    this.videoElement = null;
  }

  public destroyPlayer() {
    this.playToken++;
    this.clearLoadTimeout();
    this.player?.close();
    this.player = null;
    this.playStarted = false;
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
  }

  public pause() {
    this.videoElement?.pause();
  }

  public async play(url: string, protocol: 'rtc' | 'whep' = 'rtc') {
    const video = this.videoElement;
    if (!video) return;

    if (this.store.state.isLoading && this.store.state.url === url) {
      return;
    }

    this.destroyPlayer();
    const token = ++this.playToken;
    this.playStarted = false;

    this.store.setState((prev) => ({
      ...prev,
      url,
      isLoading: true,
      error: null,
    }));
    this.dispatch('onLoadStart');

    this.loadTimeout = setTimeout(() => {
      if (token === this.playToken && this.store.state.isLoading) {
        this.setError('连接超时，请检查网络或 SRS 服务');
      }
    }, 8000);

    try {
      let targetUrl = url;
      if (url.startsWith('webrtc://') || url.startsWith('rtc://')) {
        const parsed = new URL(
          url.replace('webrtc://', 'http://').replace('rtc://', 'http://'),
        );
        targetUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
      }

      const p: AnyPlayer =
        protocol === 'whep' ? SrsRtcWhipWhepAsync() : SrsRtcPlayerAsync();
      this.player = p;

      video.srcObject = null;
      video.srcObject = p.stream;

      video.muted = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');

      p.ontrack = (event: RTCTrackEvent) => {
        if (token !== this.playToken) return;

        if (event.track.kind === 'video' && !this.playStarted) {
          this.playStarted = true;

          const forcePlay = () => {
            if (video.paused) {
              video
                .play()
                .then(() => {
                  this.clearLoadTimeout();
                  this.store.setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    isReady: true,
                    isPlaying: true,
                    muted: true,
                  }));
                  this.dispatch('onReady');
                  this.dispatch('onLoadEnd');
                })
                .catch((error) => {
                  console.error('[OssrsPlayer] 自动播放被拦截:', error);
                });
            }
          };

          video.addEventListener('loadeddata', forcePlay, { once: true });
          video.addEventListener('canplay', forcePlay, { once: true });

          setTimeout(() => {
            if (video.paused) {
              video.play().catch(() => {});
            }
          }, 100);
        }
      };

      if ('play' in p) {
        await (p as SrsRtcPlayer | SrsRtcWhipWhep).play(targetUrl);
      }
    } catch (error: any) {
      if (token !== this.playToken) return;
      this.setError(error?.message || 'WebRTC 连接失败');
    }
  }

  public setCallbacks(cb: OssrsCallbacks) {
    this.callbacks = { ...this.callbacks, ...cb };
  }

  public setComponentCallbacks(cb: OssrsCallbacks) {
    this.componentCallbacks = cb;
  }

  public setError(error: null | string) {
    this.store.setState((prev) => ({ ...prev, error, isLoading: false }));
    if (error) this.dispatch('onError', new Error(error));
  }

  public setMuted(muted: boolean) {
    if (this.videoElement) this.videoElement.muted = muted;
    this.store.setState((prev) => ({ ...prev, muted }));
  }

  public setVolume(volume: number) {
    const vol = Math.min(1, Math.max(0, volume));
    if (this.videoElement) this.videoElement.volume = vol;
    this.store.setState((prev) => ({ ...prev, volume: vol }));
  }

  public toggle() {
    const video = this.videoElement;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  private clearLoadTimeout() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
  }

  private dispatch<K extends keyof OssrsCallbacks>(key: K, ...args: any[]) {
    (this.callbacks[key] as any)?.(...args);
    (this.componentCallbacks[key] as any)?.(...args);
  }

  private unbindVideoElement() {
    this.videoAbort?.abort();
    this.videoAbort = null;
  }
}
