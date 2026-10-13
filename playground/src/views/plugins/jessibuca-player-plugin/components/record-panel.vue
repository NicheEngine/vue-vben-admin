<script lang="ts" setup>
import { computed, ref } from 'vue';

import { Button, Card, Tag } from 'antdv-next';

const props = defineProps<{
  isRecording: boolean;
  startRecord: (fileName?: string, fileType?: string) => void;
  stopRecordAndSave: () => void;
}>();

const recordStartTime = ref<null | number>(null);
const duration = ref(0);
let timer: null | ReturnType<typeof setInterval> = null;

const elapsed = computed(() => {
  const s = Math.floor(duration.value / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
});

function toggle() {
  if (props.isRecording) {
    props.stopRecordAndSave();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    recordStartTime.value = null;
  } else {
    props.startRecord(`jessibuca-${Date.now()}`, 'webm');
    recordStartTime.value = Date.now();
    duration.value = 0;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (recordStartTime.value) {
        duration.value = Date.now() - recordStartTime.value;
      }
    }, 200);
  }
}
</script>

<template>
  <Card title="录制">
    <div class="flex flex-wrap items-center gap-3">
      <Button
        :type="isRecording ? 'primary' : 'default'"
        :danger="isRecording"
        @click="toggle"
      >
        {{ isRecording ? '停止并保存' : '开始录制' }}
      </Button>
      <Tag :color="isRecording ? 'red' : 'default'">
        {{ isRecording ? '录制中' : '未录制' }}
      </Tag>
      <span v-if="isRecording" class="text-sm text-foreground/70">
        已录制：{{ elapsed }}
      </span>
    </div>
    <div class="mt-2 text-xs text-foreground/50">
      说明：录制依赖流的编码，部分 FLV
      流可能不支持录制。录制完成后文件会自动下载为 webm。
    </div>
  </Card>
</template>
