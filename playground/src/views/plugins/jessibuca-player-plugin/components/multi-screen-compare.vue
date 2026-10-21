<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useJessibucaPlayer } from '@vben/jessibuca-player';

import { Card } from 'antdv-next';

const props = defineProps<{
  url: string;
  width: number;
  height: number;
}>();

const modes = [
  { mode: 0 as const, label: '拉伸填满' },
  { mode: 1 as const, label: '等比留黑边' },
  { mode: 2 as const, label: '等比裁切' },
];

const players = modes.map(({ mode, label }) => {
  const [Player, api] = useJessibucaPlayer({
    config: {
      autoPlay: true,
      isMute: true,
      decoder: '/jessibuca/decoder.js',
      scaleMode: mode,
      isResize: true,
      supportDblclickFullscreen: false,
      useWebFullScreen: false,
      enableRecording: false,
      debug: false,
      forceNoOffscreen: true, // 必须：防止 WebGL 多实例上下文丢失
    },
  });

  return { Player, api, mode, label };
});

// 错峰挂载标记
const renderStates = ref<boolean[]>([false, false, false]);

onMounted(() => {
  // 将错峰时间拉大，给底层 WASM 留足初始化时间
  setTimeout(() => {
    renderStates.value[0] = true;
  }, 300);

  setTimeout(() => {
    renderStates.value[1] = true;
    // 👇 修复：加上 ?. 即可消除 TS 报错
    setTimeout(() => players[1]?.api?.resize?.(), 500);
  }, 1500);

  setTimeout(() => {
    renderStates.value[2] = true;
    setTimeout(() => players[2]?.api?.resize?.(), 500);
  }, 3000);
});

onBeforeUnmount(() => {
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
          <template v-if="renderStates[index]">
            <component
              :is="p.Player"
              :api="p.api"
              :url="props.url"
              class="h-full w-full"
            />
          </template>
          <span v-else class="text-xs text-foreground/40">等待解码器资源释放...</span>
        </div>
      </div>
    </div>
  </Card>
</template>
