<script lang="ts" setup>
import type { Component } from 'vue';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { Card } from 'antdv-next';

export interface MultiScreenPlayer {
  component: Component;
  props: Record<string, any>;
  onDestroy: () => Promise<void> | void;
  label: string;
  mode: number;
}

const props = withDefaults(
  defineProps<{
    players: MultiScreenPlayer[];
    width?: number | string;
    height: number | string;
    title?: string;
  }>(),
  {
    width: '100%',
    title: '多屏对比（缩放模式）',
  },
);

const renderStates = ref<boolean[]>(props.players.map(() => false));
const timers: Array<ReturnType<typeof setTimeout>> = [];

onMounted(() => {
  // 错开渲染，防止同时初始化导致 CPU 或网络打满
  const delays = [300, 1000, 1800];
  props.players.forEach((_, i) => {
    timers.push(
      setTimeout(() => {
        renderStates.value[i] = true;
      }, delays[i] || 1800),
    );
  });
});

onBeforeUnmount(() => {
  timers.forEach((t) => clearTimeout(t));
  props.players.forEach((p) => {
    void p.onDestroy();
  });
});
</script>

<template>
  <Card :title="title">
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
          <template v-if="renderStates[index]">
            <div class="absolute inset-0">
              <component
                :is="p.component"
                v-bind="p.props"
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
