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

  public get rtcPlayer(): AnyPlayer | null {
    return this.player;
  }

  public get video(): HTMLVideoElement | null {
    return this.videoElement;
  }

  private callbacks: OssrsCallbacks = {};
  private componentCallbacks: OssrsCallbacks = {};
  private lastErrorTime = 0;
  private loadTimeout: null | ReturnType<typeof setTimeout> = null;
  private mediaListeners: Array<{ event: string; fn: () => void }> = [];
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
        if (
          this.store.state.volume !== video.volume ||
          this.store.state.muted !== video.muted
        ) {
          this.store.setState((prev) => ({
            ...prev,
            volume: video.volume,
            muted: video.muted,
          }));
        }
      },
      { signal },
    );

    video.addEventListener(
      'timeupdate',
      () => {
        const changed =
          Math.abs(this.store.state.currentTime - video.currentTime) > 0.1 ||
          this.store.state.videoWidth !== video.videoWidth;
        if (changed) {
          this.store.setState((prev) => ({
            ...prev,
            currentTime: video.currentTime,
            videoWidth: video.videoWidth || prev.videoWidth,
            videoHeight: video.videoHeight || prev.videoHeight,
          }));
          this.dispatch('onTimeUpdate', video.currentTime);
        }
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
    this.lastErrorTime = 0;
    this.mediaListeners.forEach(({ event, fn }) => {
      this.videoElement?.removeEventListener(event, fn);
    });
    this.mediaListeners = [];

    if (this.videoElement?.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      this.videoElement.srcObject = null;
    }

    this.player?.close();
    this.player = null;
    this.playStarted = false;

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
    }

    this.store.setState((prev) => ({
      ...prev,
      isPlaying: false,
      isReady: false,
      isLoading: false,
      error: null,
      videoWidth: 0,
      videoHeight: 0,
      currentTime: 0,
    }));
  }

  public getCallbacks(): Readonly<OssrsCallbacks> {
    return this.callbacks;
  }

  public async getStats() {
    const pc = this.player?.pc;
    if (!pc) return null;
    return pc.getStats();
  }

  public pause() {
    this.videoElement?.pause();
  }

  public async play(url: string, protocol: 'rtc' | 'whep' = 'rtc') {
    const video = this.videoElement;
    if (!video) return;

    if (this.store.state.isLoading && this.store.state.url === url) return;

    this.destroyPlayer();
    const token = ++this.playToken;
    this.playStarted = false;
    this.lastErrorTime = 0;
    this.store.setState((prev) => ({
      ...prev,
      url,
      isLoading: true,
      isReady: false,
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

      video.srcObject = p.stream;
      video.muted = this.store.state.muted;
      video.setAttribute('muted', this.store.state.muted ? '' : 'false');
      video.setAttribute('playsinline', '');

      if (this.store.state.autoplay) {
        video.setAttribute('autoplay', '');
      } else {
        video.removeAttribute('autoplay');
      }

      p.ontrack = (event: RTCTrackEvent) => {
        if (token !== this.playToken) return;

        if (!p.stream.getTracks().includes(event.track)) {
          p.stream.addTrack(event.track);
        }

        // 不要做任何 applyConstraints！

        if (event.track.kind === 'video') {
          const syncDimensions = () => {
            if (token !== this.playToken) return;
            if (video.videoWidth > 0) {
              this.store.setState((prev) => ({
                ...prev,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
              }));
            } else {
              setTimeout(syncDimensions, 200);
            }
          };
          syncDimensions();
        }

        if (event.track.kind === 'video' && !this.playStarted) {
          this.playStarted = true;

          if (!this.store.state.autoplay) {
            this.clearLoadTimeout();
            this.store.setState((prev) => ({
              ...prev,
              isLoading: false,
              isReady: true,
              isPlaying: false,
            }));
            this.dispatch('onReady');
            this.dispatch('onLoadEnd');
            return;
          }

          const forcePlay = () => {
            if (token !== this.playToken) return;
            if (video.paused) {
              video
                .play()
                .then(() => {
                  this.clearLoadTimeout();
                  if (token === this.playToken) {
                    this.store.setState((prev) => ({
                      ...prev,
                      isLoading: false,
                      isReady: true,
                      isPlaying: true,
                    }));
                    this.dispatch('onReady');
                    this.dispatch('onLoadEnd');
                  }
                })
                .catch((error) => {
                  console.error('[SrsPlayer] 自动播放失败:', error);
                });
            }
          };

          this.mediaListeners.push(
            { event: 'loadeddata', fn: forcePlay },
            { event: 'canplay', fn: forcePlay },
          );
          video.addEventListener('loadeddata', forcePlay, { once: true });
          video.addEventListener('canplay', forcePlay, { once: true });
          setTimeout(forcePlay, 100);
        }
      };

      if (p.pc) {
        p.pc.addEventListener('connectionstatechange', () => {
          if (token !== this.playToken) return;
          const state = p.pc?.connectionState;
          if (state === 'disconnected' || state === 'failed') {
            this.setError(`WebRTC 连接${state === 'failed' ? '失败' : '断开'}`);
          }
        });
      }

      if ('play' in p) {
        await p.play(targetUrl);
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
    if (!error) {
      this.store.setState((prev) => ({ ...prev, error: null }));
      return;
    }

    if (this.store.state.isPlaying && this.store.state.videoWidth > 0) {
      console.warn('[OssrsPlayerApi] 瞬时断连，忽略错误:', error);
      return;
    }

    const now = Date.now();
    if (now - this.lastErrorTime < 2000) {
      return;
    }
    this.lastErrorTime = now;

    this.store.setState((prev) => ({ ...prev, error, isLoading: false }));
    this.dispatch('onError', new Error(error));
  }

  public setMuted(muted: boolean) {
    if (this.videoElement) {
      this.videoElement.muted = muted;
      if (!muted && this.videoElement.paused) {
        this.videoElement.play().catch(console.warn);
      }
    }
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
      video
        .play()
        .then(() =>
          this.store.setState((prev) => ({ ...prev, isPlaying: true })),
        )
        .catch(() => {});
    } else {
      video.pause();
      this.store.setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }

  private clearLoadTimeout() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
  }

  private dispatch(key: keyof OssrsCallbacks, ...args: any[]) {
    try {
      (this.callbacks[key] as any)?.(...args);
    } catch (error) {
      console.warn(`[OssrsPlayerApi] user callback "${key}" error:`, error);
    }
    try {
      (this.componentCallbacks[key] as any)?.(...args);
    } catch (error) {
      console.warn(
        `[OssrsPlayerApi] component callback "${key}" error:`,
        error,
      );
    }
  }

  private unbindVideoElement() {
    this.videoAbort?.abort();
    this.videoAbort = null;
  }
}
