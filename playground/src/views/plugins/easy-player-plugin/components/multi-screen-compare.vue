<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useEasyPlayer } from '@vben/easy-player';

import { Card } from 'antdv-next';

const props = defineProps<{
  url: string;
  width: number;
  height: number;
}>();

const modes = [
  { mode: 0 as const, label: '拉伸填满', stretch: true },
  { mode: 1 as const, label: '等比留黑边', stretch: false },
  { mode: 2 as const, label: '等比裁切', stretch: false },
];

const players = modes.map(({ mode, label, stretch }) => {
  const [Player, api] = useEasyPlayer({
    autoplay: true,
    muted: true,
    videoUrl: props.url,
    easyStretch: stretch,
    hasAudio: false, // 多屏静音，避免 3 份音频同时拉流
    showEnterprise: false,
    showCustomButton: false,
    // ✅ 多屏并发时关闭调试日志，减少主线程开销
    debug: false,
  });

  return { Player, api, mode, label };
});

const renderStates = ref<boolean[]>([false, false, false]);
const timers: Array<ReturnType<typeof setTimeout>> = [];

/**
 * ✅ 对齐 Jessibuca：错峰间隔拉长到 300 / 1500 / 3000ms，
 * 并在每屏挂载后延迟 500ms 触发一次 forceResize，
 * 规避 easy-player 内部 video.js 尺寸计算错误。
 */
function forceResize(index: number) {
  const root = document.querySelectorAll('easy-player')[index] as
    | HTMLElement
    | undefined;
  if (!root) return;
  const video = root.querySelector('video') as HTMLVideoElement | null;
  const wrapper = root.querySelector('.video-js') as HTMLElement | null;
  if (video) {
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
  }
  if (wrapper) {
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
  }
}

onMounted(() => {
  timers.push(
    setTimeout(() => {
      renderStates.value[0] = true;
      timers.push(setTimeout(() => forceResize(0), 500));
    }, 300),
    setTimeout(() => {
      renderStates.value[1] = true;
      timers.push(setTimeout(() => forceResize(1), 500));
    }, 1500),
    setTimeout(() => {
      renderStates.value[2] = true;
      timers.push(setTimeout(() => forceResize(2), 500));
    }, 3000),
  );
});

onBeforeUnmount(() => {
  timers.forEach((t) => clearTimeout(t));
  // ✅ 逐个销毁，避免瞬间释放冲击主线程
  players.forEach((p, i) => {
    setTimeout(() => {
      void p.api.destroy();
    }, i * 50);
  });
});
</script>

<template>
  <Card title="多屏对比（缩放模式）">
    <div class="mb-3 text-xs text-foreground/60">
      同一路流，三种缩放模式并排对比。容器尺寸：{{ width }} × {{ height }}。
    </div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="(p, index) in players"
        :key="p.mode"
        class="flex flex-col gap-2"
      >
        <div class="text-sm text-foreground/70">{{ p.label }}</div>
        <div
          class="relative overflow-hidden rounded border border-border bg-black flex items-center justify-center"
          :style="{ width: `${width}px`, height: `${height}px` }"
        >
          <template v-if="renderStates[index] && props.url">
            <component
              :is="p.Player"
              :player-api="p.api"
              :video-url="props.url"
              class="h-full w-full"
            />
          </template>
          <span v-else class="text-xs text-foreground/40 text-center px-2">
            等待解码器资源释放...
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>
