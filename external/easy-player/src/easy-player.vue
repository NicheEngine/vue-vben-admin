<script setup lang="ts">
import type { EasyPlayerInstance } from './types';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { EasyPlayerApi } from './easy-player-api';

const props = withDefaults(
  defineProps<{
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
    playerApi?: EasyPlayerApi;
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
    scaleMode?: 0 | 1 | 2;
    keepPlayingOffscreen?: boolean; // ✅ 新增
    showEnterprise?: boolean;
    showCustomButton?: boolean;
    videoTitle?: string;
    videoUrl: string;
    watermark?: string;
  }>(),
  {
    alt: '无信号',
    aspect: '16:9',
    autoplay: true,
    currentTime: 0,
    debug: false,
    decodeType: 'auto',
    easyStretch: false,
    hasAudio: true,
    hiddenRightMenu: false,
    iceServers: () => [],
    isH265: false,
    isTransCoding: false,
    live: true,
    loop: false,
    muted: true,
    playerApi: undefined,
    playerStyle: 'width: 100%;height: 100%;',
    poster: '',
    progress: false,
    reconnection: true,
    recordFileName: '',
    recordMaxFileSize: 200,
    remoteHost: '',
    resolution: 'hd',
    resolutionDefault: 'hd',
    restartTime: 60 * 60 * 6,
    scaleMode: 1,
    keepPlayingOffscreen: false, // ✅ 新增
    showEnterprise: true,
    showCustomButton: true,
    videoTitle: '',
    watermark: undefined,
  },
);

const emit = defineEmits<{
  ended: [];
  error: [error: Error | string];
  pause: [];
  play: [];
  recording: [];
  snapshot: [];
  timeupdate: [currentTime: number];
}>();

const tagName = 'easy-player';
const wrapperRef = ref<HTMLElement>();
const playerEl = ref<HTMLElement>();

const ownsApi = !props.playerApi;
const api = props.playerApi ?? new EasyPlayerApi();

api.setComponentCallbacks({
  onEnded: () => emit('ended'),
  onError: (err) => emit('error', err),
  onPause: () => emit('pause'),
  onPlay: () => emit('play'),
  onRecording: () => emit('recording'),
  onSnapshot: () => emit('snapshot'),
  onTimeUpdate: (t) => emit('timeupdate', t),
});

let instance: EasyPlayerInstance | null = null;
let retryCount = 0;
let mounted = false;

let domObserver: MutationObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null; // ✅ 新增视口观察
let videoEl: HTMLVideoElement | null = null;

// 监听 props 变更
watch(
  () => props.videoUrl,
  (url: string, old: string) => {
    if (url && url !== old) api.setUrl(url);
  },
);
watch(
  () => props.muted,
  (muted: boolean) => api.setMuted(muted),
);
watch(
  () => props.autoplay,
  (autoplay: boolean) => api.setConfig({ autoplay }),
);
watch(
  () => props.scaleMode,
  (mode: 0 | 1 | 2) => api.setScaleMode(mode),
);
watch(
  () => props.keepPlayingOffscreen,
  (val: boolean) => {
    api.setKeepPlayingOffscreen(val);

    // ✅ 核心新增：切换开关时，立即根据当前视口状态执行恢复/暂停
    const video = wrapperRef.value?.querySelector('video') as HTMLVideoElement;
    if (video) {
      const rect = video.getBoundingClientRect();
      const isOutOfView = rect.bottom < 0 || rect.top > window.innerHeight;

      if (isOutOfView) {
        if (!val && !video.paused) {
          // 用户关闭了离屏继续播放，且视频在屏幕外 -> 立即暂停
          console.warn('[EasyPlayer] 开关关闭，立即暂停屏幕外的视频');
          (video as any).__originalPause?.();
          api.updatePlaying(false);
        } else if (val && video.paused) {
          // 用户开启了离屏继续播放，且视频在屏幕外但已暂停 -> 立即恢复播放
          console.warn('[EasyPlayer] 开关开启，立即恢复屏幕外的视频');
          video.play().catch((error) => console.warn('Play failed:', error));
          api.updatePlaying(true);
        }
      }
    }
  },
);

watch(
  () => [props.decodeType, props.isH265, props.isTransCoding, props.live],
  async ([decodeType, isH265, isTransCoding, live]) => {
    api.setConfig({ decodeType, isH265, isTransCoding, live } as any);
    if (mounted && api.needsRebuild()) {
      await rebuildInstance();
    }
  },
);

function tryGetInstance() {
  if (!playerEl.value || instance) return;
  const inst =
    (playerEl.value as any).getVueInstance?.() ??
    (playerEl.value as any).__vue__ ??
    null;

  if (inst) {
    instance = inst;
    api.bindInstance(instance);
    api.updateReady(true);
  } else if (retryCount < 10) {
    retryCount++;
    setTimeout(tryGetInstance, 100);
  } else {
    api.setError('播放器实例初始化超时');
  }
}

async function createInstance() {
  await nextTick();
  if (!playerEl.value || instance) return;
  tryGetInstance();
}

async function destroyInstance() {
  if (!instance) return;
  try {
    api.destroyPlayer();
  } finally {
    instance = null;
  }
}

async function rebuildInstance() {
  await destroyInstance();
  api.clearRebuildFlag();
  retryCount = 0;
  await createInstance();
  if (api.store.state.url) api.play();
}

// ✅ 核心：绑定原生 video 事件 & 重写 pause
function bindVideoEvents(video: HTMLVideoElement) {
  if (videoEl === video) return;
  unbindVideoEvents();
  videoEl = video;

  // 重写 pause 方法拦截自动暂停
  const originalPause = video.pause.bind(video);
  (video as any).__originalPause = originalPause;

  video.pause = function () {
    const isKeepPlaying = api.store.state.keepPlayingOffscreen;

    if (isKeepPlaying && !this.paused && api.store.state.isPlaying) {
      const rect = this.getBoundingClientRect();
      // 判断是否完全在视口外
      const isOutOfView = rect.bottom < 0 || rect.top > window.innerHeight;

      if (isOutOfView) {
        console.warn('[EasyPlayer] 拦截屏幕外自动暂停');
        return;
      }
    }
    originalPause();
  };

  const onPlay = () => api.updatePlaying(true);
  const onPause = () => api.updatePlaying(false);
  const onEnded = () => api.updateEnded();
  const onTimeUpdate = () => api.updateCurrentTime(video.currentTime || 0);
  const onLoadedMetadata = () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      api.updateVideoSize(video.videoWidth, video.videoHeight);
    }
  };
  const onError = () => {
    const msg = video.error?.message || '播放出错';
    if (
      msg.includes('reconnect') ||
      msg.includes('MSE') ||
      msg.includes('buffer')
    )
      return;
    api.setError(msg);
  };

  video.addEventListener('play', onPlay);
  video.addEventListener('playing', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onEnded);
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('loadedmetadata', onLoadedMetadata);
  video.addEventListener('error', onError);

  (video as any).__cleanupEvents = () => {
    if ((video as any).__originalPause) {
      video.pause = (video as any).__originalPause;
      delete (video as any).__originalPause;
    }
    video.removeEventListener('play', onPlay);
    video.removeEventListener('playing', onPlay);
    video.removeEventListener('pause', onPause);
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.removeEventListener('loadedmetadata', onLoadedMetadata);
    video.removeEventListener('error', onError);
  };

  if (!video.paused) api.updatePlaying(true);
}

function unbindVideoEvents() {
  if (videoEl && (videoEl as any).__cleanupEvents) {
    (videoEl as any).__cleanupEvents();
    (videoEl as any).__cleanupEvents = null;
  }
  videoEl = null;
}

function checkAndBindVideo() {
  if (!wrapperRef.value) return;
  const video = wrapperRef.value.querySelector('video') as HTMLVideoElement;
  if (video) {
    bindVideoEvents(video);
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      api.updateVideoSize(video.videoWidth, video.videoHeight);
    }
  }
}

// ✅ 核心修复：处理页面进入后台/恢复可见的逻辑
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    console.warn('[EasyPlayer] 页面恢复可见，重新同步状态');
    const video = wrapperRef.value?.querySelector('video') as HTMLVideoElement;
    if (video) {
      // 强制同步一次底层真实状态
      api.updatePlaying(!video.paused);
      // 如果用户开启了离屏继续播放，但底层被浏览器强行挂了，尝试拉起
      if (
        api.store.state.keepPlayingOffscreen &&
        api.store.state.isPlaying &&
        video.paused
      ) {
        video.play().catch(() => {});
      }
    }
  }
}

onMounted(async () => {
  mounted = true;
  await nextTick();

  if (wrapperRef.value) {
    api.bindContainer(wrapperRef.value);

    domObserver = new MutationObserver(() => {
      checkAndBindVideo();
    });
    domObserver.observe(wrapperRef.value, { childList: true, subtree: true });

    // ✅ 使用 IntersectionObserver 监听视口可见性
    intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const isVisible = entry.isIntersecting;
        if (!isVisible && api.store.state.keepPlayingOffscreen) {
          console.warn(
            '[EasyPlayer] 元素离开视口，但因为开启离屏播放，保持播放状态。',
          );
        }
      }
    });
    intersectionObserver.observe(wrapperRef.value);

    checkAndBindVideo();
  }

  // ✅ 监听页面切后台/恢复
  document.addEventListener('visibilitychange', handleVisibilityChange);

  if (props.videoUrl && !api.store.state.url) {
    api.setUrl(props.videoUrl);
  }

  await createInstance();
});

onBeforeUnmount(() => {
  mounted = false;

  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  unbindVideoEvents();
  api.bindContainer(null);

  if (instance) {
    if (ownsApi) api.destroyPlayer();
    instance = null;
  }
  if (ownsApi) api.destroy();
});

defineExpose({
  api,
  resize: () => api.setScaleMode(api.store.state.scaleMode),
});
</script>

<template>
  <div ref="wrapperRef" class="easy-player-wrapper">
    <component
      :is="tagName"
      ref="playerEl"
      :video-url="props.videoUrl"
      :autoplay="props.autoplay"
      :muted="props.muted"
      :alt="props.alt"
      :aspect="props.aspect"
      :decode-type="props.decodeType"
      :easy-stretch="props.easyStretch"
      :has-audio="props.hasAudio"
      :hidden-right-menu="props.hiddenRightMenu"
      :is-h265="props.isH265"
      :is-trans-coding="props.isTransCoding"
      :live="props.live"
      :loop="props.loop"
      :player-style="props.playerStyle"
      :poster="props.poster"
      :progress="props.progress"
      :reconnection="props.reconnection"
      :record-file-name="props.recordFileName"
      :record-max-file-size="props.recordMaxFileSize"
      :remote-host="props.remoteHost"
      :resolution="props.resolution"
      :resolution-default="props.resolutionDefault"
      :restart-time="props.restartTime"
      :show-enterprise="props.showEnterprise"
      :show-custom-button="true"
      :stretch="true"
      :video-title="props.videoTitle"
      :watermark="props.watermark"
    />
  </div>
</template>

<style scoped>
/* 保持不变 */
.easy-player-wrapper {
  --easy-player-fit: contain;

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #000;
}

.easy-player-wrapper :deep(easy-player) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
}

.easy-player-wrapper :deep(easy-player > div),
.easy-player-wrapper :deep(.video-js) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
}

.easy-player-wrapper :deep(video),
.easy-player-wrapper :deep(canvas) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: var(--easy-player-fit, contain) !important;
}
</style>
