<script lang="ts" setup>
import type { IPlayerApi } from '../types';

import { Card, Tag } from 'antdv-next';

const props = defineProps<{ player: IPlayerApi }>();

const SCALE_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '拉伸填满',
  1: '等比留黑边',
  2: '等比裁切',
};

const scaleModeLabel = (mode: 0 | 1 | 2) => SCALE_MODE_LABELS[mode] ?? '未知';
</script>

<template>
  <Card title="播放状态">
    <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
      <div>
        <span class="text-foreground/60">播放中：</span>
        <Tag :color="props.player.isPlaying.value ? 'green' : 'red'">
          {{ props.player.isPlaying.value ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">加载中：</span>
        <Tag :color="props.player.isLoading.value ? 'orange' : 'default'">
          {{ props.player.isLoading.value ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">就绪：</span>
        <Tag :color="props.player.isReady.value ? 'green' : 'default'">
          {{ props.player.isReady.value ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">静音：</span>
        <Tag :color="props.player.isMuted.value ? 'orange' : 'green'">
          {{ props.player.isMuted.value ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">音量：</span>
        <span>{{ Math.round(props.player.volume.value * 100) }}%</span>
      </div>
      <div>
        <span class="text-foreground/60">分辨率：</span>
        <span>
          {{ props.player.videoWidth.value }} ×
          {{ props.player.videoHeight.value }}
        </span>
      </div>
      <div>
        <span class="text-foreground/60">网络延迟：</span>
        <span>{{
            Number(props.player.networkDelay.value || 0).toFixed(0)
          }}
          ms</span>
      </div>
      <div>
        <span class="text-foreground/60">缩放模式：</span>
        <span>{{ scaleModeLabel(props.player.scaleMode.value) }}</span>
      </div>
      <div>
        <span class="text-foreground/60">当前时间：</span>
        <span>{{ props.player.currentTime.value.toFixed(1) }} s</span>
      </div>
      <div class="col-span-2 md:col-span-3">
        <span class="text-foreground/60">错误信息：</span>
        <span
          v-if="props.player.error.value"
          class="rounded bg-red-500/10 px-2 py-0.5 text-red-500"
        >
          {{ props.player.error.value }}
        </span>
        <span v-else class="text-foreground/60">无</span>
      </div>
    </div>
  </Card>
</template>
