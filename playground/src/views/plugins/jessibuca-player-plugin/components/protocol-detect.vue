<script lang="ts" setup>
import type { ProtocolInfo } from '../utils/protocol';

import { computed, ref } from 'vue';

import { Button, Input, Tag } from 'antdv-next';

import { detectProtocol, probeUrl } from '../utils/protocol';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  apply: [url: string];
  reset: [];
}>();

const url = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const info = computed<ProtocolInfo>(() => detectProtocol(url.value));

const probing = ref(false);
const probeResult = ref<null | {
  ok: boolean;
  status?: number;
  contentType?: string;
  error?: string;
}>(null);

async function handleProbe() {
  if (!url.value) return;
  probing.value = true;
  probeResult.value = null;
  try {
    probeResult.value = await probeUrl(url.value);
  } finally {
    probing.value = false;
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <Input
        v-model:value="url"
        class="min-w-[320px] flex-1"
        placeholder="ws://...flv / http://...flv / https://...m3u8"
        allow-clear
        @keydown.enter="emit('apply', url)"
      />
      <Button type="primary" @click="emit('apply', url)">应用</Button>
      <Button @click="emit('reset')">恢复</Button>
      <Button :loading="probing" @click="handleProbe">探测</Button>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-foreground/60">协议识别：</span>
      <Tag :color="info.color">{{ info.label }}</Tag>
      <span class="text-foreground/50">{{ info.description }}</span>
    </div>

    <div v-if="probeResult" class="text-sm">
      <span class="text-foreground/60">探测结果：</span>
      <Tag :color="probeResult.ok ? 'green' : 'red'">
        {{ probeResult.ok ? '可访问' : '不可访问' }}
      </Tag>
      <span v-if="probeResult.status" class="ml-2 text-foreground/50">
        HTTP {{ probeResult.status }}
      </span>
      <span v-if="probeResult.contentType" class="ml-2 text-foreground/50">
        Content-Type: {{ probeResult.contentType }}
      </span>
      <span v-if="probeResult.error" class="ml-2 text-red-500">
        {{ probeResult.error }}
      </span>
    </div>
  </div>
</template>
