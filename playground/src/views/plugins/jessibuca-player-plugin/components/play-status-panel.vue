<script lang="ts" setup>
import { Card, Tag } from 'antdv-next';

defineProps<{
  isPlaying: boolean;
  isLoading: boolean;
  isRecording: boolean;
  isMuted: boolean;
  videoWidth: number;
  videoHeight: number;
  networkDelay: number;
  errorMsg: null | string;
  scaleModeLabel: string;
}>();
</script>

<template>
  <Card title="播放状态">
    <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
      <div>
        <span class="text-foreground/60">播放中：</span>
        <Tag :color="isPlaying ? 'green' : 'red'">
          {{ isPlaying ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">加载中：</span>
        <Tag :color="isLoading ? 'orange' : 'default'">
          {{ isLoading ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">录制中：</span>
        <Tag :color="isRecording ? 'red' : 'default'">
          {{ isRecording ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">静音：</span>
        <Tag :color="isMuted ? 'orange' : 'green'">
          {{ isMuted ? '是' : '否' }}
        </Tag>
      </div>
      <div>
        <span class="text-foreground/60">分辨率：</span>
        <span>{{ videoWidth }} × {{ videoHeight }}</span>
      </div>
      <div>
        <span class="text-foreground/60">网络延迟：</span>
        <span>{{ networkDelay }} ms</span>
      </div>
      <div>
        <span class="text-foreground/60">缩放模式：</span>
        <span>{{ scaleModeLabel }}</span>
      </div>
      <div class="col-span-2 md:col-span-3">
        <span class="text-foreground/60">错误信息：</span>
        <span
          v-if="errorMsg"
          class="rounded bg-red-500/10 px-2 py-0.5 text-red-500"
        >
          {{ errorMsg }}
        </span>
        <span v-else class="text-foreground/60">无</span>
      </div>
    </div>
  </Card>
</template>
