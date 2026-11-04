<script lang="ts" setup>
import type { OssrsObjectFit } from '@vben/ossrs-player';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useOssrsPlayer } from '@vben/ossrs-player';

import { Card } from 'antdv-next';

import { createOssrsAdapter } from '../../player-shared';
const props = withDefaults(
  defineProps<{
    url: string;
    width?: number | string;
    height: number | string;
    protocol?: 'rtc' | 'whep';
  }>(),
  {
    protocol: 'rtc',
    width: '100%',
  },
);

const modes = [
  { mode: 0 as const, label: '拉伸填满', fit: 'fill' as OssrsObjectFit },
  { mode: 1 as const, label: '等比留黑边', fit: 'contain' as OssrsObjectFit },
  { mode: 2 as const, label: '等比裁切', fit: 'cover' as OssrsObjectFit },
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
    <div class="grid grid-cols-3 gap-4">
      <div
        v-for="(p, index) in players"
        :key="p.mode"
        class="flex flex-col gap-2 shrink-0"
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
                :protocol="props.protocol || 'rtc'"
                :autoplay="true"
                :muted="true"
                :object-fit="p.fit"
                class="h-full w-full"
              />
            </div>
          </template>
          <span v-else class="text-xs text-foreground/40 text-center px-2">
            等待 WebRTC 连接调度...
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>
