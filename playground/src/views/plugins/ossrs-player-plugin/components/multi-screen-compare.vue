<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useOssrsPlayer } from '@vben/ossrs-player';

import { Card } from 'antdv-next';

import { createOssrsAdapter } from '../../player-shared';

const props = defineProps<{
  url: string;
  width: number;
  height: number;
  protocol?: 'rtc' | 'whep';
}>();

const modes = [
  { mode: 0 as const, label: '拉伸填满', fit: 'fill' as const },
  { mode: 1 as const, label: '等比留黑边', fit: 'contain' as const },
  { mode: 2 as const, label: '等比裁切', fit: 'cover' as const },
];

const players = modes.map(({ mode, label, fit }) => {
  // 👈 直接在这里把 url 注入给底层，让 api 自己控制播放
  const [Player, api] = useOssrsPlayer({
    initialUrl: props.url,
    initialState: {
      autoplay: true,
      muted: true,
      url: props.url,
    },
  });
  const adapter = createOssrsAdapter(api, props.protocol || 'rtc');
  adapter.setScaleMode?.(mode);

  return { Player, api, adapter, mode, label, fit };
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
    }, 1000),
    setTimeout(() => {
      renderStates.value[2] = true;
    }, 1800),
  );
});

onBeforeUnmount(() => {
  timers.forEach((t) => clearTimeout(t));
  players.forEach((p) => {
    void p.adapter.destroy?.();
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
            <!-- 👈 不要把 url 再传给组件了，让它直接从 store 里拿 -->
            <component
              :is="p.Player"
              :api="p.api"
              :url="props.url"
              :protocol="props.protocol || 'rtc'"
              :autoplay="true"
              :muted="true"
              class="h-full w-full"
              :style="{ objectFit: p.fit }"
            />
          </template>
          <span v-else class="text-xs text-foreground/40 text-center px-2">
            等待 WebRTC 连接调度...
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>
