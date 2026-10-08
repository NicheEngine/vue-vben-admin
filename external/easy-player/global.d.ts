/// <reference types="vite/client" />
/**
 * EasyPlayer 全局组件类型声明
 *
 * 说明：@easydarwin/easyplayer 通过全局 script 引入（EasyPlayer-lib.min.js），
 * 注册为自定义元素 <easy-player>，Vue 模板中使用时需要声明类型。
 */
declare module 'vue' {
  export interface GlobalComponents {
    EasyPlayer: typeof import('@easydarwin/easyplayer').default;
  }
}

/**
 * 如果 @easydarwin/easyplayer 没有自带类型声明，
 * 需要在这里手动声明模块类型。
 */
declare module '@easydarwin/easyplayer' {
  import type { DefineComponent } from 'vue';

  const EasyPlayer: DefineComponent<{
    alt?: string;
    aspect?: string;
    autoplay?: boolean;
    currentTime?: number;
    debug?: boolean;
    decodeType?: string;
    easyStretch?: boolean;
    hasAudio?: boolean;
    hiddenRightMenu?: boolean;
    iceServers?: RTCIceServer[];
    isH265?: boolean;
    isTransCoding?: boolean;
    live?: boolean;
    loop?: boolean;
    muted?: boolean;
    playerStyle?: string;
    poster?: string;
    progress?: boolean;
    reconnection?: boolean;
    recordFileName?: string;
    recordMaxFileSize?: number;
    remoteHost?: string;
    resolution?: string;
    resolutionDefault?: string;
    restartTime?: number;
    showEnterprise?: boolean;
    videoTitle?: string;
    videoUrl?: string;
    watermark?: string;
  }>;

  export default EasyPlayer;
}
