<script setup lang="ts">
import type { EasyPlayerInstance } from './types';

import { nextTick, onMounted, ref, watch } from 'vue';

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
    showEnterprise?: boolean;
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
    showEnterprise: true,
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

const containerRef = ref<{ getVueInstance: () => EasyPlayerInstance }>();
const api = props.playerApi ?? new EasyPlayerApi();

watch(
  () => props.videoUrl,
  (url, old) => {
    if (url && url !== old) api.setUrl(url);
  },
);
watch(
  () => props.muted,
  (muted) => api.setMuted(muted),
);
watch(
  () => props.autoplay,
  (autoplay) => {
    api.store.setState((prev) => ({ ...prev, autoplay }));
  },
);

function onPlay() {
  api.updatePlaying(true);
  emit('play');
}
function onPause() {
  api.updatePlaying(false);
  emit('pause');
}
function onError(event: any) {
  const message = event?.message || String(event);
  api.setError(message);
  emit('error', event);
}
function onEnded() {
  api.updateEnded();
  emit('ended');
}
function onTimeUpdate(event: number | { currentTime?: number }) {
  const time = typeof event === 'number' ? event : (event?.currentTime ?? 0);
  api.updateCurrentTime(time);
  emit('timeupdate', time);
}
function onSnapshot() {
  api.snapshot();
  emit('snapshot');
}
function onRecording() {
  api.switchRecording();
  emit('recording');
}

onMounted(async () => {
  await nextTick();
  const instance = containerRef.value?.getVueInstance?.() ?? null;
  api.bindInstance(instance);
  api.updateReady(!!instance);
});

defineExpose({ api });
</script>

<template>
  <div class="easy-player-wrapper">
    <easy-player
      ref="containerRef"
      :alt="props.alt"
      :aspect="props.aspect"
      :autoplay="props.autoplay"
      :current-time="props.currentTime"
      :debug="props.debug"
      :decode-type="props.decodeType"
      :easy-stretch="props.easyStretch"
      :has-audio="props.hasAudio"
      :hidden-right-menu="props.hiddenRightMenu"
      :ice-servers="props.iceServers"
      :is-h265="props.isH265"
      :is-trans-coding="props.isTransCoding"
      :live="props.live"
      :loop="props.loop"
      :muted="props.muted"
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
      :video-url="props.videoUrl"
      :watermark="props.watermark"
      @ended="onEnded"
      @error="onError"
      @pause="onPause"
      @play="onPlay"
      @recording="onRecording"
      @snapshot="onSnapshot"
      @timeupdate="onTimeUpdate"
    />
  </div>
</template>

<style scoped>
.easy-player-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
