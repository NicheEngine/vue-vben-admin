<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useJessibucaPlayer } from '@vben/jessibuca-player';

import { Card } from 'antdv-next';

const props = withDefaults(
  defineProps<{
    url: string;
    width?: number | string;
    height: number | string;
  }>(),
  {
    width: '100%',
  },
);

const modes = [
  { mode: 0, label: '拉伸填满', scaleMode: 0 },
  { mode: 1, label: '等比留黑边', scaleMode: 1 },
  { mode: 2, label: '等比裁切', scaleMode: 2 },
] as const;

const players = modes.map(({ mode, label, scaleMode }) => {
  const [Player, api] = useJessibucaPlayer({
    config: {
      autoPlay: true,
      isMute: true,
      decoder: '/jessibuca/decoder.js',
      scaleMode,
      isResize: true,
      supportDblclickFullscreen: false,
      useWebFullScreen: false,
      enableRecording: false,
      debug: false,
      forceNoOffscreen: true,
    },
  });

  return { Player, api, mode, label };
});

const renderStates = ref<boolean[]>([false, false, false]);
const timers: Array<ReturnType<typeof setTimeout>> = [];

onMounted(() => {
  timers.push(
    setTimeout(() => {
      renderStates.value[0] = true;
    }, 300),
    setTimeout(() => {
      renderStates.value[1] = true;
    }, 1500),
    setTimeout(() => {
      renderStates.value[2] = true;
    }, 3000),
  );
});

onBeforeUnmount(() => {
  timers.forEach((t) => clearTimeout(t));
  players.forEach((p) => {
    void p.api.destroy();
  });
});
</script>

<template>
  <Card title="多屏对比（缩放模式）">
    <div class="mb-3 text-xs text-foreground/60">
      同一路流，三种缩放模式并排对比。容器尺寸：{{ width }} × {{ height }}。
    </div>
    <div class="grid grid-cols-3 gap-4">
      <div
        v-for="(p, index) in players"
        :key="p.mode"
        class="flex flex-col gap-2 min-w-0"
        :style="{
          width:
            typeof props.width === 'number' ? `${props.width}px` : props.width,
        }"
      >
        <div class="text-sm text-foreground/70">{{ p.label }}</div>
        <div
          class="relative overflow-hidden rounded border border-border bg-black flex items-center justify-center w-full"
          :style="{
            height:
              typeof props.height === 'number'
                ? `${props.height}px`
                : props.height,
          }"
        >
          <template v-if="renderStates[index] && props.url">
            <div class="absolute inset-0">
              <component
                :is="p.Player"
                :api="p.api"
                :url="props.url"
                class="h-full w-full"
              />
            </div>
          </template>
          <span v-else class="text-xs text-foreground/40 text-center px-2">
            等待解码器调度...
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>
