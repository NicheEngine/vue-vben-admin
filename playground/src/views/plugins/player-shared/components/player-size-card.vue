<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  Button,
  Card,
  InputNumber,
  Select,
  SpaceAddon,
  SpaceCompact,
} from 'antdv-next';

const props = defineProps<{
  videoWidth?: number;
  videoHeight?: number;
}>();

const sizeMode = ref<'auto' | 'fixed' | 'ratio'>('auto');
const fixedWidth = ref(800);
const fixedHeight = ref(450);
const ratio = ref('16:9');
const ratioBaseWidth = ref(960);

const DEFAULT_RATIO = { label: '16 : 9（宽屏）', value: '16:9', w: 16, h: 9 };
const ratioOptions = [
  DEFAULT_RATIO,
  { label: '4 : 3（传统）', value: '4:3', w: 4, h: 3 },
  { label: '21 : 9（超宽）', value: '21:9', w: 21, h: 9 },
  { label: '1 : 1（方形）', value: '1:1', w: 1, h: 1 },
  { label: '9 : 16（竖屏）', value: '9:16', w: 9, h: 16 },
  { label: '3 : 4（竖屏）', value: '3:4', w: 3, h: 4 },
];

const containerStyle = computed(() => {
  if (sizeMode.value === 'fixed') {
    return { width: `${fixedWidth.value}px`, height: `${fixedHeight.value}px` };
  }
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    const height = Math.round((ratioBaseWidth.value * opt.h) / opt.w);
    return { width: `${ratioBaseWidth.value}px`, height: `${height}px` };
  }
  return {
    width: '100%',
    aspectRatio:
      props.videoWidth && props.videoHeight
        ? `${props.videoWidth}/${props.videoHeight}`
        : '16/9',
    maxHeight: '600px',
  };
});

const containerRatio = computed(() => {
  if (sizeMode.value === 'fixed') {
    return fixedHeight.value
      ? (fixedWidth.value / fixedHeight.value).toFixed(2)
      : '-';
  }
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    return (opt.w / opt.h).toFixed(2);
  }
  return (props.videoWidth || 16) / (props.videoHeight || 9) > 0
    ? ((props.videoWidth || 16) / (props.videoHeight || 9)).toFixed(2)
    : '-';
});

const videoRatio = computed(() => {
  if (!props.videoWidth || !props.videoHeight) return '-';
  return (props.videoWidth / props.videoHeight).toFixed(2);
});
</script>

<template>
  <Card class="mb-4" title="画面与尺寸">
    <!-- ✅ 新增：直接在这里渲染播放器插槽 -->
    <div class="flex justify-center w-full mb-6">
      <div
        class="overflow-hidden rounded-xl border border-border bg-black relative"
        :style="containerStyle"
      >
        <slot></slot>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <span class="text-sm">尺寸模式：</span>
      <Select
        v-model:value="sizeMode"
        class="w-40"
        :options="[
          { label: '自适应', value: 'auto' },
          { label: '固定宽高', value: 'fixed' },
          { label: '固定比例', value: 'ratio' },
        ]"
      />
      <span class="ml-2 text-xs text-foreground/50">
        容器比例：{{ containerRatio }} | 视频比例：{{ videoRatio }}
      </span>
    </div>

    <div
      v-if="sizeMode === 'fixed'"
      class="mt-4 flex flex-wrap items-center gap-3"
    >
      <span class="text-sm">宽：</span>
      <SpaceCompact>
        <InputNumber v-model:value="fixedWidth" :min="160" :max="3840" />
        <SpaceAddon>px</SpaceAddon>
      </SpaceCompact>
      <span class="ml-2 text-sm">高：</span>
      <SpaceCompact>
        <InputNumber v-model:value="fixedHeight" :min="90" :max="2160" />
        <SpaceAddon>px</SpaceAddon>
      </SpaceCompact>
      <Button
        size="small"
        @click="
          fixedWidth = 1280;
          fixedHeight = 720;
        "
      >
        1280 × 720
      </Button>
      <Button
        size="small"
        @click="
          fixedWidth = 1920;
          fixedHeight = 1080;
        "
        >
1920 × 1080
</Button>
    </div>

    <div
      v-if="sizeMode === 'ratio'"
      class="mt-4 flex flex-wrap items-center gap-3"
    >
      <span class="text-sm">比例：</span>
      <Select v-model:value="ratio" class="w-40" :options="ratioOptions" />
      <span class="ml-2 text-sm">宽度：</span>
      <SpaceCompact>
        <InputNumber v-model:value="ratioBaseWidth" :min="160" :max="3840" />
        <SpaceAddon>px</SpaceAddon>
      </SpaceCompact>
      <span class="text-xs text-foreground/50">高度按比例自动计算</span>
    </div>
  </Card>
</template>
