<script setup lang="ts">
import type { Ref } from 'vue';

import { onMounted, onUnmounted, ref, watch } from 'vue';

import { SrsRtcPlayerAsync } from './player';
import { SrsRtcWhipWhepAsync } from './whipwhep';

const props = defineProps<{
  autoPlay?: boolean;
  protocol?: 'rtc' | 'whep';
  url: string;
}>();

const emit = defineEmits<{
  (e: 'error', error: Error | string): void;
  (e: 'pause' | 'play'): void;
}>();

const videoElement: Ref<HTMLVideoElement | null> = ref(null);
const state = ref<'connecting' | 'error' | 'idle' | 'playing'>('idle');
const errorMessage = ref('');
const isPlaying = ref(false);

interface GenericPlayer {
  close(): void;
  ontrack?: (event: RTCTrackEvent) => void;
  pc: null | RTCPeerConnection;
  play(url: string): Promise<any>;
  stream: MediaStream;
}

let player: GenericPlayer | null = null;

function useWhepProtocol(): boolean {
  if (props.protocol === 'whep') return true;
  if (props.protocol === 'rtc') return false;
  return props.url.includes('/whep/') || props.url.includes('/whip-play/');
}

async function startPlay(playUrl: string) {
  if (!playUrl) return;
  stopPlay();

  state.value = 'connecting';
  errorMessage.value = '';

  try {
    const createPlayer = useWhepProtocol()
      ? SrsRtcWhipWhepAsync
      : SrsRtcPlayerAsync;
    const p = createPlayer();
    player = p;

    p.ontrack = () => {
      if (
        videoElement.value &&
        p.stream &&
        videoElement.value.srcObject !== p.stream
      ) {
        videoElement.value.srcObject = p.stream;
      }
    };

    await p.play(playUrl);

    if (videoElement.value && p.stream) {
      videoElement.value.srcObject = p.stream;
      await videoElement.value.play();
      isPlaying.value = true;
    }

    state.value = 'playing';
    emit('play');
  } catch (error: any) {
    console.error('WebRTC 播放失败:', error);
    state.value = 'error';
    errorMessage.value = error?.message || String(error);
    emit('error', error);
  }
}

function stopPlay() {
  if (player) {
    player.close();
    player = null;
  }
  if (videoElement.value) {
    videoElement.value.pause();
    videoElement.value.srcObject = null;
  }
  isPlaying.value = false;
  state.value = state.value === 'error' ? 'error' : 'idle';
}

async function replay() {
  if (props.url) await startPlay(props.url);
}

function togglePlay() {
  if (!videoElement.value) return;
  if (videoElement.value.paused) {
    videoElement.value.play();
    isPlaying.value = true;
    emit('play');
  } else {
    videoElement.value.pause();
    isPlaying.value = false;
    emit('pause');
  }
}

function toggleFullscreen() {
  if (!videoElement.value) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    videoElement.value.requestFullscreen();
  }
}

onMounted(() => {
  if (props.autoPlay && props.url) {
    startPlay(props.url);
  }
});

watch(
  () => props.url,
  (newUrl, oldUrl) => {
    if (newUrl && newUrl !== oldUrl) {
      startPlay(newUrl);
    } else if (!newUrl) {
      stopPlay();
    }
  },
);

onUnmounted(() => {
  stopPlay();
});
</script>
<template>
  <div class="relative w-full rounded-lg overflow-hidden bg-black aspect-video">
    <!-- 视频元素 -->
    <video
      ref="videoElement"
      class="w-full h-full object-contain"
      playsinline
      :autoplay="true"
      :muted="true"
    ></video>

    <!-- 连接中遮罩 -->
    <div
      v-if="state === 'connecting'"
      class="absolute inset-0 flex items-center justify-center bg-black/50 text-white"
    >
      <div class="flex flex-col items-center gap-2">
        <div
          class="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"
        ></div>
        <span class="text-sm">连接中...</span>
      </div>
    </div>

    <!-- 错误遮罩 -->
    <div
      v-if="state === 'error'"
      class="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-4"
    >
      <div class="text-center">
        <svg
          class="w-10 h-10 mx-auto mb-2 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="text-sm font-medium">{{ errorMessage || '播放失败' }}</p>
        <button
          v-if="url"
          @click="replay"
          class="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition"
        >
          重试
        </button>
      </div>
    </div>

    <!-- 底部控制栏 -->
    <div
      v-if="state === 'playing'"
      class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity duration-200"
    >
      <div class="flex items-center gap-2 text-white">
        <button @click="togglePlay" class="p-1 hover:bg-white/20 rounded">
          <svg
            v-if="!isPlaying"
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>
        <button
          @click="toggleFullscreen"
          class="p-1 hover:bg-white/20 rounded ml-auto"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
