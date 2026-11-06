<script lang="ts" setup>
import type { AutoPlayerExpose, PlayerEngine } from '@vben/auto-player';

import type { IPlayerApi } from '../player-shared';

import { computed, ref, shallowRef, watch } from 'vue';

import { AutoPlayer } from '@vben/auto-player';
import { Page } from '@vben/common-ui';

import { Card, Select, Switch, Tag } from 'antdv-next';

import {
  NetworkChart,
  PlayerControlCard,
  PlayerSizeCard,
  PlayStatusPanel,
  ProtocolDetect,
} from '../player-shared';

defineOptions({ name: 'AutoPlayerPluginExample' });

// 1. 基础实例引用
const autoPlayerRef = shallowRef<AutoPlayerExpose | null>(null);
// 使用 shallowRef，避免深层解包引起类型冲突
const activeProxyApi = shallowRef<IPlayerApi | null>(null);

// 监听引擎的变化，重新赋值。
// 关键点：赋值时用 as any 强行绕过 Vue 的类型解包检测，因为运行时的 proxyApi 是没问题的。
watch(
  () => autoPlayerRef.value?.api.getActiveEngine(),
  () => {
    activeProxyApi.value =
      (autoPlayerRef.value?.api as unknown as IPlayerApi) || null;
  },
  { immediate: true },
);

// 2. 地址与配置
const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);

const config = ref({ autoplay: true, muted: true });
const forcedEngine = ref<PlayerEngine>('none');
const showStatus = ref(true);

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

// 3. 交互方法
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

// 4. 控制适配
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
</script>

<template>
  <Page title="AutoPlayer 终极联合播放器">
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

    <!-- ✅ 使用标准的 PlayerSizeCard 包裹 AutoPlayer -->
    <PlayerSizeCard
      class="mb-4"
      v-if="activeProxyApi"
      :player="activeProxyApi"
      :show-status="showStatus"
      :video-width="activeProxyApi.videoWidth.value"
      :video-height="activeProxyApi.videoHeight.value"
    >
      <AutoPlayer
        ref="autoPlayerRef"
        :url="currentUrl"
        :prefer-engine="forcedEngine"
        :autoplay="config.autoplay"
        :muted="config.muted"
        class="w-full h-full absolute inset-0"
      />
    </PlayerSizeCard>

    <!-- ✅ 使用标准的 PlayStatusPanel -->
    <PlayStatusPanel
      class="mb-4"
      v-if="activeProxyApi"
      :player="activeProxyApi"
    />

    <!-- ✅ 使用标准的 PlayerControlCard -->
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
      @scale-mode-change="(m) => activeProxyApi?.setScaleMode?.(m)"
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

    <!-- ✅ 网络统计 -->
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
  </Page>
</template>
