<script setup lang="ts">
import type { IPlayerApi } from '@vben/player-types';

import { Button, Card, Switch, Tag } from 'antdv-next';

const props = defineProps<{
  player: IPlayerApi;
  isCleared?: boolean;
}>();

const emit = defineEmits<{
  (e: 'clear' | 'fullscreen' | 'reload' | 'toggle'): void;
  (e: 'scaleModeChange', mode: 0 | 1 | 2): void;
  (e: 'volumeChange', v: number): void;
  (e: 'muteChange', m: boolean): void;
}>();

const SCALE_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '拉伸填满',
  1: '等比留黑边',
  2: '等比裁切',
};
</script>

<template>
  <Card class="mb-4" title="播放控制">
    <div class="flex flex-wrap items-center gap-3">
      <Button @click="emit('toggle')">
        {{ player.isPlaying.value && !props.isCleared ? '暂停' : '播放' }}
      </Button>
      <Button @click="emit('reload')">重新加载</Button>
      <Button @click="emit('fullscreen')">全屏播放</Button>
      <Button @click="emit('clear')">清除画面</Button>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-2 whitespace-nowrap">
        <span class="text-sm">静音：</span>
        <Switch
          :checked="player.isMuted.value"
          @change="(v: any) => emit('muteChange', v)"
        />
      </div>
      <div class="flex items-center gap-2 whitespace-nowrap">
        <span class="text-sm shrink-0">音量：</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="player.volume.value"
          class="w-40 shrink-0"
          @input="
            (e) =>
              emit('volumeChange', Number((e.target as HTMLInputElement).value))
          "
        />
        <span class="text-xs text-foreground/50 w-10 text-right shrink-0">
          {{ Math.round(player.volume.value * 100) }}%
        </span>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <span class="text-sm shrink-0">缩放模式：</span>
      <Button
        v-for="mode in [0, 1, 2]"
        :key="mode"
        :type="player.scaleMode.value === mode ? 'primary' : 'default'"
        size="small"
        @click="emit('scaleModeChange', mode as 0 | 1 | 2)"
      >
        {{ mode === 0 ? '拉伸' : mode === 1 ? '等比留黑边' : '等比裁切' }}
      </Button>
      <Tag color="blue">
        {{ SCALE_MODE_LABELS[player.scaleMode.value] ?? '未知' }}
      </Tag>
    </div>

    <!-- 插槽：允许各个页面插入自己特有的配置 -->
    <slot name="extra"></slot>
  </Card>
</template>
