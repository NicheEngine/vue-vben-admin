<script lang="ts" setup>
import type { ProbeResult } from '../utils';

import { computed, ref } from 'vue';

import { Button, Input, Select, Tag } from 'antdv-next';

import { detectProtocol, probeUrl } from '../utils';

interface EngineOption {
  type: string;
  label: string;
  available: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    /** 可选引擎候选（按优先级排序），仅 auto-player 场景传入 */
    engines?: EngineOption[];
    /** 当前激活引擎，仅 auto-player 场景传入 */
    activeEngine?: string;
    /** 是否显示引擎选择下拉（默认 false，保持旧用法不显示） */
    showEngineSelect?: boolean;
  }>(),
  {
    placeholder: 'ws://...flv / http://...flv / https://...m3u8',
    engines: () => [],
    activeEngine: '',
    showEngineSelect: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:activeEngine': [value: string];
  apply: [url: string];
  reset: [];
  engineChange: [type: string];
}>();

const url = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const info = computed(() => {
  const urlStr = url.value.trim();
  if (!urlStr) return detectProtocol(urlStr);

  const lower = urlStr.toLowerCase();
  // 针对 OSSRS 的全协议特殊处理
  if (lower.startsWith('webrtc://') || lower.startsWith('rtc://')) {
    return {
      protocol: 'webrtc',
      label: 'SRS RTC',
      color: 'green',
      description: '超低延迟 WebRTC',
    };
  }
  if (lower.includes('/whep/') || lower.includes('/whip-play/')) {
    return {
      protocol: 'whep',
      label: 'WHEP',
      color: 'blue',
      description: '标准 WebRTC 协议',
    };
  }
  if (lower.includes('.flv')) {
    return {
      protocol: 'http-flv',
      label: 'HTTP-FLV',
      color: 'green',
      description: '支持通过 OSSRS 极速播放',
    };
  }
  if (lower.includes('.m3u8')) {
    return {
      protocol: 'hls',
      label: 'HLS (m3u8)',
      color: 'blue',
      description: '支持通过 OSSRS 兼容播放',
    };
  }
  return detectProtocol(urlStr);
});

const probing = ref(false);
const probeResult = ref<null | ProbeResult>(null);

// 是否已探测（探测结果为非空）
const probed = computed(() => probeResult.value !== null);

// 引擎下拉显示条件：启用 + 有候选 + 已探测
const showEngineSelector = computed(
  () =>
    props.showEngineSelect && (props.engines?.length ?? 0) > 0 && probed.value,
);

const engineSelectOptions = computed(() =>
  (props.engines ?? []).map((e) => ({
    label: e.available ? e.label : `${e.label}（不可用）`,
    value: e.type,
    disabled: !e.available,
  })),
);

// 点击应用时，触发自动探测
async function handleApply() {
  if (!url.value) return;
  emit('apply', url.value);

  probing.value = true;
  probeResult.value = null;
  try {
    probeResult.value = await probeUrl(url.value);
  } finally {
    probing.value = false;
  }
}

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

function handleReset() {
  url.value = '';
  probeResult.value = null;
  emit('reset');
}

function handleEngineChange(value: string) {
  emit('update:activeEngine', value);
  emit('engineChange', value);
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <Input
        v-model:value="url"
        class="min-w-[320px] flex-1"
        :placeholder="placeholder"
        allow-clear
        @keydown.enter="handleApply"
      />
      <Button type="primary" @click="handleApply">应用</Button>
      <Button @click="handleReset">重置</Button>
      <Button :loading="probing" @click="handleProbe">探测</Button>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-foreground/60">协议识别：</span>
      <Tag :color="info.color">{{ info.label }}</Tag>
      <span class="text-foreground/50">{{ info.description }}</span>
    </div>

    <!-- 探测结果 + 引擎切换（探测后显示） -->
    <div
      v-if="probeResult"
      class="mt-2 flex flex-wrap items-center gap-2 text-sm"
    >
      <span class="text-foreground/60">探测结果：</span>
      <Tag :color="probeResult.ok ? 'success' : 'error'">
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

      <!-- 引擎切换：探测后显示 -->
      <template v-if="showEngineSelector">
        <span class="ml-2 text-sm whitespace-nowrap text-foreground/60">
          引擎：
        </span>
        <Select
          :value="activeEngine || undefined"
          class="w-40"
          :options="engineSelectOptions"
          @change="handleEngineChange"
        />
      </template>
    </div>
  </div>
</template>
