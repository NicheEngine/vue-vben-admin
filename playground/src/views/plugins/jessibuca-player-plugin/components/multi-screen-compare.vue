<script lang="ts" setup>
import { useJessibucaPlayer } from '@vben/jessibuca-player';

import { Card } from 'antdv-next';

const props = defineProps<{
  url: string;
  width: number;
  height: number;
}>();

const modes = [
  { mode: 0 as const, label: '拉伸' },
  { mode: 1 as const, label: '等比留黑边' },
  { mode: 2 as const, label: '等比裁切' },
];

// 3 个独立播放器实例
const players = modes.map(({ mode }) => {
  const [Player, api] = useJessibucaPlayer({
    url: props.url,
    config: {
      autoPlay: true,
      isMute: true,
      decoder: '/jessibuca/decoder.js',
      scaleMode: mode,
      isResize: true,
      supportDblclickFullscreen: false,
      useWebFullScreen: false,
      loadingTimeoutReplay: false,
      heartTimeoutReplay: false,
    },
  });
  return { Player, api, mode };
});
</script>

<template>
  <Card title="多屏对比（缩放模式）">
    <div class="mb-3 text-xs text-foreground/60">
      同一路流，三种缩放模式并排对比。容器尺寸：
      {{ width }} × {{ height }}。
    </div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div v-for="p in players" :key="p.mode" class="flex flex-col gap-2">
        <div class="text-sm text-foreground/70">
          {{
            p.mode === 0 ? '拉伸填满' : p.mode === 1 ? '等比留黑边' : '等比裁切'
          }}
        </div>
        <div
          class="overflow-hidden rounded border border-border bg-black"
          :style="{ width: `${width}px`, height: `${height}px` }"
        >
          <component
            :is="p.Player"
            :api="p.api"
            :url="props.url"
            class="h-full w-full"
          />
        </div>
      </div>
    </div>
  </Card>
</template>
