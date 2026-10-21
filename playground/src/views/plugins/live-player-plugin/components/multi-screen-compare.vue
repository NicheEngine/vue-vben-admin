<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useLivePlayer } from '@vben/live-player';

import { Card } from 'antdv-next';

const props = defineProps<{
  url: string;
  width: number;
  height: number;
  type?: any;
}>();

const modes = [
  { mode: 0 as const, label: '拉伸填满', fit: 'fill' },
  { mode: 1 as const, label: '等比留黑边', fit: 'contain' },
  { mode: 2 as const, label: '等比裁切', fit: 'cover' },
];

const players = modes.map(({ mode, label, fit }) => {
  const [Player, api] = useLivePlayer({
    autoplay: true,
    muted: true,
    controls: false,
    type: props.type,
  });
  return { Player, api, mode, label, fit };
});

// 错峰挂载机制
const renderStates = ref<boolean[]>([false, false, false]);

onMounted(() => {
  setTimeout(() => {
    renderStates.value[0] = true;
  }, 300);
  setTimeout(() => {
    renderStates.value[1] = true;
  }, 1500);
  setTimeout(() => {
    renderStates.value[2] = true;
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
    <div class="flex flex-wrap gap-4">
      <div
        v-for="(p, index) in players"
        :key="p.mode"
        class="flex flex-col gap-2 shrink-0"
        :style="{ width: `${width}px` }"
      >
        <div class="text-sm text-foreground/70">{{ p.label }}</div>
        <div
          class="relative overflow-hidden rounded border border-border bg-black flex items-center justify-center"
          :style="{ width: `${width}px`, height: `${height}px` }"
        >
          <template v-if="renderStates[index] && props.url">
            <!-- 给 video 标签加上 object-fit 来实现缩放模式 -->
            <component
              :is="p.Player"
              :api="p.api"
              :url="props.url"
              class="h-full w-full"
              :style="{ objectFit: p.fit }"
            />
          </template>
          <span v-else class="text-xs text-foreground/40 text-center px-2">
            等待解码器调度...
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>
