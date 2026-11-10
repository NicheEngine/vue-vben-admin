<script lang="ts" setup>
import type { AutoPlayerExpose, PlayerEngine } from '@vben/auto-player';

import type { IPlayerApi } from '../player-shared';

import { computed, ref } from 'vue';

import { AutoPlayer } from '@vben/auto-player';
import { Page } from '@vben/common-ui';

import { Card, Select, Switch, Tag } from 'antdv-next';

import {
  NetworkChart,
  PlayerControlCard,
  PlayerSizeCard,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';

defineOptions({ name: 'AutoPlayerPluginExample' });

// ============================================================
// 1. 基础实例引用与 API 代理
// ============================================================
const autoPlayerRef = ref<AutoPlayerExpose | null>(null);

// 直接获取 Proxy Api
const activeProxyApi = computed<IPlayerApi | null>(() => {
  return (autoPlayerRef.value?.api as unknown as IPlayerApi) || null;
});

// ✅ 核心修复：单独抽离出响应式的 capabilities 判断，防止 v-if 无法响应 Getter 的属性变化
const canRecord = computed(() => {
  return !!activeProxyApi.value?.capabilities?.record;
});

const canScreenshot = computed(() => {
  return !!activeProxyApi.value?.capabilities?.screenshot;
});

// ============================================================
// 2. 地址与配置
// ============================================================
const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);

const config = ref({ autoplay: true, muted: true });
const forcedEngine = ref<PlayerEngine>('none');
const showStatus = ref(true);
const showMultiScreen = ref(false);

const engineOptions = [
  { label: '自动识别', value: 'none' },
  { label: '强制 OSSRS (WebRTC)', value: 'ossrs' },
  { label: '强制 LivePlayer (HLS/FLV)', value: 'live' },
  { label: '强制 Jessibuca (FLV)', value: 'jessibuca' },
  { label: '强制 EasyPlayer (FLV)', value: 'easy' },
];

const activeEngineLabel = computed(() => {
  const engine = autoPlayerRef.value?.api.getActiveEngine();
  const map: Record<string, string> = {
    ossrs: 'OSSRS (WebRTC)',
    live: 'LivePlayer',
    jessibuca: 'Jessibuca',
    easy: 'EasyPlayer',
    none: '无可用引擎',
  };
  return map[engine || 'none'];
});

// ============================================================
// 3. 缩放模式配置
// ============================================================
const scaleMode = ref<0 | 1 | 2>(1);
const SCALE_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '拉伸填满',
  1: '等比留黑边',
  2: '等比裁切',
};
const SCALE_MODE_FIT: Record<0 | 1 | 2, 'contain' | 'cover' | 'fill'> = {
  0: 'fill',
  1: 'contain',
  2: 'cover',
};

// ============================================================
// 4. 交互方法
// ============================================================
function applyUrl(u?: string) {
  const value = (u ?? inputUrl.value).trim();
  if (!value) return;
  currentUrl.value = value;
  const history = urlHistory.value.filter((h) => h !== value);
  history.unshift(value);
  urlHistory.value = history.slice(0, 10);
}

function resetUrl() {
  inputUrl.value = DEFAULT_URL;
  currentUrl.value = DEFAULT_URL;
  urlHistory.value = [];
}

function handleToggle() {
  activeProxyApi.value?.toggle();
}
function handleReload() {
  if (currentUrl.value) activeProxyApi.value?.setUrl(currentUrl.value);
}
function handleFullscreen() {
  activeProxyApi.value?.requestFullscreen?.();
}
function handleClear() {
  activeProxyApi.value?.destroy();
}
function handleMuteChange(checked: boolean) {
  config.value.muted = checked;
  activeProxyApi.value?.setMuted(checked);
}
function handleVolumeChange(v: number) {
  activeProxyApi.value?.setVolume(v);
  if (v === 0 && !config.value.muted) {
    config.value.muted = true;
    activeProxyApi.value?.setMuted(true);
  } else if (v > 0 && config.value.muted) {
    config.value.muted = false;
    activeProxyApi.value?.setMuted(false);
  }
}
function handleScaleModeChange(mode: 0 | 1 | 2) {
  scaleMode.value = mode;
  activeProxyApi.value?.setScaleMode?.(mode);
}
function handleScreenshot(): string {
  const result = activeProxyApi.value?.screenshot?.();
  return typeof result === 'string' ? result : '';
}

// ============================================================
// 5. 多屏对比
// ============================================================
const multiEngine = computed(() => {
  return autoPlayerRef.value?.api.getActiveEngine() || 'none';
});
</script>

<template>
  <Page title="AutoPlayer 终极联合播放器">
    <!-- 播放地址与引擎 -->
    <Card class="mb-4" title="播放地址与引擎">
      <ProtocolDetect v-model="inputUrl" @apply="applyUrl" @reset="resetUrl" />
      <div class="mt-4 flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm">强制切换引擎：</span>
          <Select
            v-model:value="forcedEngine"
            class="w-56"
            :options="engineOptions"
          />
        </div>
        <Tag color="blue">当前生效：{{ activeEngineLabel }}</Tag>
      </div>
    </Card>

    <!-- 播放器主区域 -->
    <PlayerSizeCard
      class="mb-4"
      :player="activeProxyApi as any"
      :show-status="showStatus"
      :video-width="activeProxyApi?.videoWidth.value || 0"
      :video-height="activeProxyApi?.videoHeight.value || 0"
    >
      <AutoPlayer
        ref="autoPlayerRef"
        :url="currentUrl"
        :prefer-engine="forcedEngine"
        :autoplay="config.autoplay"
        :muted="config.muted"
        class="w-full h-full absolute inset-0"
      />
      <div
        v-if="!currentUrl"
        class="absolute inset-0 flex items-center justify-center text-foreground/40 text-sm"
      >
        暂无视频源
      </div>
    </PlayerSizeCard>

    <!-- 状态面板 -->
    <PlayStatusPanel
      class="mb-4"
      v-if="activeProxyApi"
      :player="activeProxyApi"
    />

    <!-- 播放控制 -->
    <PlayerControlCard
      class="mb-4"
      v-if="activeProxyApi"
      :player="activeProxyApi"
      :is-cleared="false"
      @toggle="handleToggle"
      @reload="handleReload"
      @fullscreen="handleFullscreen"
      @clear="handleClear"
      @mute-change="handleMuteChange"
      @volume-change="handleVolumeChange"
      @scale-mode-change="handleScaleModeChange"
    >
      <template #extra>
        <div
          class="mt-4 flex flex-wrap items-center gap-6 border-t border-border pt-4"
        >
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm">自动播放：</span>
            <Switch v-model:checked="config.autoplay" />
          </div>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm">显示状态标签：</span>
            <Switch v-model:checked="showStatus" />
          </div>
        </div>
      </template>
    </PlayerControlCard>

    <!-- 网络统计 -->
    <Card class="mb-4" title="网络质量实时曲线" v-if="activeProxyApi">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NetworkChart
          :value="(activeProxyApi.stats.value?.vbps || 0) / 8 / 1024"
          label="实时码率"
          unit="kB/s"
          color="#22c55e"
        />
        <NetworkChart
          :value="activeProxyApi.networkDelay.value || 0"
          label="网络延迟"
          unit="ms"
          color="#f59e0b"
        />
      </div>
    </Card>

    <!-- ✅ 修复：始终渲染面板，或者用 computed 判断 -->
    <RecordPanel
      v-if="canRecord"
      class="mb-4"
      :is-recording="activeProxyApi?.isRecording.value || false"
      :recording-duration="activeProxyApi?.recordingDuration.value || 0"
      :start-record="activeProxyApi?.startRecord || (() => {})"
      :stop-record-and-save="activeProxyApi?.stopRecordAndSave || (() => {})"
      :can-record="activeProxyApi?.isPlaying.value || false"
    />

    <ScreenshotPreview
      v-if="canScreenshot"
      class="mb-4"
      :capture="handleScreenshot"
    />

    <!-- 多屏对比 -->
    <Card class="mb-4" title="多屏对比">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <span class="text-sm">启用：</span>
        <Switch
          :checked="showMultiScreen"
          @change="(val) => (showMultiScreen = val)"
        />
      </div>
      <div v-if="showMultiScreen" class="grid grid-cols-3 gap-4">
        <div v-for="mode in [0, 1, 2]" :key="mode" class="flex flex-col gap-2">
          <div class="text-sm text-foreground/70">
            {{ SCALE_MODE_LABELS[mode as 0 | 1 | 2] }}
          </div>
          <div
            class="relative overflow-hidden rounded border border-border bg-black h-[200px]"
          >
            <AutoPlayer
              :url="currentUrl"
              :prefer-engine="multiEngine"
              :object-fit="SCALE_MODE_FIT[mode as 0 | 1 | 2]"
              class="w-full h-full absolute inset-0"
              :muted="true"
            />
          </div>
        </div>
      </div>
    </Card>
  </Page>
</template>
