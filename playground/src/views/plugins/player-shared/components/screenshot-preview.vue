<script lang="ts" setup>
import { ref } from 'vue';

import { Button, Card, Image } from 'antdv-next';

const props = defineProps<{ capture: () => string | undefined }>();

const previews = ref<{ url: string; time: string }[]>([]);

function handleCapture() {
  let dataUrl: string | undefined;
  try {
    dataUrl = props.capture();
  } catch (error) {
    console.error('[ScreenshotPreview] capture 失败：', error);
    return;
  }
  if (!dataUrl) {
    console.warn('[ScreenshotPreview] 截图失败，可能视频未就绪');
    return;
  }
  previews.value.unshift({
    url: dataUrl,
    time: new Date().toLocaleTimeString(),
  });
  if (previews.value.length > 12) previews.value.pop();
}

function download(url: string, time: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = `screenshot-${time.replaceAll(':', '-')}.png`;
  a.click();
}

function clearAll() {
  previews.value = [];
}
</script>

<template>
  <Card title="截图预览">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <Button type="primary" @click="handleCapture">截取当前画面</Button>
      <Button :disabled="previews.length === 0" @click="clearAll">
        清空（{{ previews.length }}）
      </Button>
    </div>

    <div v-if="previews.length === 0" class="text-sm text-foreground/50">
      暂无截图，点击上方按钮截取。
    </div>

    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
    >
      <div
        v-for="(item, idx) in previews"
        :key="idx"
        class="group relative overflow-hidden rounded border border-border"
      >
        <Image :src="item.url" class="block w-full" />
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 p-1 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100"
        >
          {{ item.time }}
        </div>
        <Button
          size="small"
          class="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100"
          @click="download(item.url, item.time)"
        >
          下载
        </Button>
      </div>
    </div>
  </Card>
</template>
