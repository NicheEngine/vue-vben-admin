<script lang="ts" setup>
import type { LiveObjectFit } from '@vben/live-player';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useLivePlayer } from '@vben/live-player';

import { Card } from 'antdv-next';

const props = withDefaults(
  defineProps<{
    url: string;
    width?: number | string;
    height: number | string;
    type?: any;
  }>(),
  {
    width: '100%',
    type: undefined,
  },
);

const modes = [
  { mode: 0, label: '拉伸填满', fit: 'fill' as LiveObjectFit },
  { mode: 1, label: '等比留黑边', fit: 'contain' as LiveObjectFit },
  { mode: 2, label: '等比裁切', fit: 'cover' as LiveObjectFit },
] as const;

const players = modes.map(({ mode, label, fit }) => {
  const [Player, api] = useLivePlayer({
    autoplay: true,
    muted: true,
    controls: false,
    type: props.type,
  });
  return { Player, api, mode, label, fit };
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
                :object-fit="p.fit"
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
