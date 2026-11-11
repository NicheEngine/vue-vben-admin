<script lang="ts" setup>
import type { AutoMultiScreenPlayer } from '@vben/auto-player';

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { createAutoMultiScreenPlayers, useAutoPlayer } from '@vben/auto-player';
import { Page } from '@vben/common-ui';

import { Card, Switch, Tag } from 'antdv-next';

import {
  MultiScreenCompare,
  NetworkChart,
  PlayerControlCard,
  PlayerErrorOverlay,
  PlayerSizeCard,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';

defineOptions({ name: 'AutoPlayerPluginExample' });

const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);
const showMultiScreen = ref(false);
const isCleared = ref(false);
// 新增：当前激活引擎（与 ProtocolDetect 双向）
const activeEngine = ref('');

const [Player, api] = useAutoPlayer({
  muted: true,
  autoplay: true,
  initialUrl: '',
  jessibucaOptions: {
    initialConfig: {
      decoder: '/jessibuca/decoder.js',
    },
  },
});

const player = api;
const engineType = computed(() => api.getEngineType());
const chooserResult = computed(() => api.getChooserResult());
// 新增：候选引擎（按 URL 优先级 + 资源可用性）
const engineCandidates = computed(() => {
  // 依赖 currentUrl 触发重算
  void currentUrl.value;
  return api.getCandidates();
});

const multiPlayers = shallowRef<AutoMultiScreenPlayer[]>([]);

function destroyMultiPlayers() {
  multiPlayers.value.forEach((p) => {
    void p.onDestroy();
  });
  multiPlayers.value = [];
}

function rebuildMultiPlayers() {
  destroyMultiPlayers();
  if (!showMultiScreen.value || !currentUrl.value) return;
  multiPlayers.value = createAutoMultiScreenPlayers(
    currentUrl.value,
    engineType.value ?? undefined,
  );
}

watch(
  [showMultiScreen, currentUrl, engineType],
  () => {
    rebuildMultiPlayers();
  },
  { immediate: false },
);

onBeforeUnmount(() => {
  destroyMultiPlayers();
  void api.destroy();
});

function applyUrl(u?: string) {
  const value = (u ?? inputUrl.value).trim();
  if (!value) return;
  isCleared.value = false;
  currentUrl.value = value;
  const history = urlHistory.value.filter((h) => h !== value);
  history.unshift(value);
  urlHistory.value = history.slice(0, 10);
  void api.setUrlAsync(value).then(() => {
    // 同步实际选中引擎
    activeEngine.value = api.getEngineType() ?? '';
  });
}

function resetUrl() {
  inputUrl.value = DEFAULT_URL;
  urlHistory.value = [];
  isCleared.value = false;
  activeEngine.value = '';
  void api.reset().then(() => {
    // 2. 清空 currentUrl 触发 v-if 卸载
    currentUrl.value = DEFAULT_URL;
  });
}

// 新增：手动切换引擎
async function handleEngineChange(type: string) {
  activeEngine.value = type;
  await api.switchType(type as any);
}

function handleToggle() {
  if (isCleared.value) {
    isCleared.value = false;
    void api.play();
    return;
  }
  void api.toggle();
}
function handleReload() {
  isCleared.value = false;
  void api.reload();
}
function handleRetry() {
  isCleared.value = false;
  void api.retry();
}
function handleClear() {
  isCleared.value = true;
  void api.clear();
}
function handleScreenshot(): string {
  const result = player.screenshot();
  return typeof result === 'string' ? result : '';
}

onBeforeUnmount(() => {
  void api.destroy();
});
</script>

<template>
  <Page title="AutoPlayer 统一播放器">
    <template #description>
      <div class="mt-2 text-foreground/80">
        根据 URL 协议 / 编码 / 资源可用性自动选择引擎，支持手动切换。
      </div>
    </template>

    <Card class="mb-4" title="播放地址">
      <ProtocolDetect
        v-model="inputUrl"
        v-model:active-engine="activeEngine"
        :engines="engineCandidates"
        :show-engine-select="engineCandidates.length > 1"
        @apply="applyUrl"
        @reset="resetUrl"
        @engine-change="handleEngineChange"
      />
      <div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span class="text-foreground/50">当前地址：{{ currentUrl || '（空）' }}</span>
        <Tag v-if="engineType" color="blue">引擎：{{ engineType }}</Tag>
        <Tag v-if="chooserResult" color="green">{{ chooserResult.reason }}</Tag>
      </div>
    </Card>

    <PlayerSizeCard
      class="mb-4"
      :video-width="player.videoWidth.value"
      :video-height="player.videoHeight.value"
      :player="player"
      :show-status="true"
      :is-cleared="isCleared"
    >
      <Player
        v-if="currentUrl && !isCleared"
        :url="currentUrl"
        :api="api"
        class="absolute inset-0 h-full w-full"
      />
      <div
        v-if="!currentUrl && !isCleared"
        class="absolute inset-0 flex items-center justify-center text-sm text-foreground/40"
      >
        暂无视频源
      </div>
      <div
        v-if="isCleared"
        class="absolute inset-0 z-10 flex items-center justify-center bg-black"
      >
        <span class="text-sm text-foreground/40">画面已清除</span>
      </div>
      <PlayerErrorOverlay
        :error="player.error.value"
        :is-reconnecting="player.isLoading.value"
        @retry="handleRetry"
      />
    </PlayerSizeCard>

    <PlayStatusPanel class="mb-4" :player="player" />

    <PlayerControlCard
      class="mb-4"
      :player="player"
      :is-cleared="isCleared"
      @toggle="handleToggle"
      @reload="handleReload"
      @clear="handleClear"
      @mute-change="(m) => api.setMuted(m)"
      @volume-change="(v) => api.setVolume(v)"
      @scale-mode-change="(m) => api.setScaleMode(m)"
    />

    <Card class="mb-4" title="网络质量实时曲线">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NetworkChart
          :value="(player.stats.value.vbps || 0) / 8 / 1024"
          label="实时码率"
          unit="kB/s"
          color="#22c55e"
        />
        <NetworkChart
          :value="player.networkDelay.value"
          label="网络延迟"
          unit="ms"
          color="#f59e0b"
        />
      </div>
    </Card>

    <template v-if="player.capabilities.record">
      <RecordPanel
        class="mb-4"
        :is-recording="player.isRecording.value"
        :recording-duration="player.recordingDuration.value"
        :start-record="(n, t) => api.startRecord(n, t)"
        :stop-record-and-save="() => api.stopRecordAndSave()"
        :can-record="player.isPlaying.value"
      />
    </template>

    <template v-if="player.capabilities.screenshot">
      <ScreenshotPreview class="mb-4" :capture="handleScreenshot" />
    </template>

    <Card class="mb-4" title="多屏对比">
      <div class="mb-3 flex items-center gap-3">
        <span class="text-sm">启用：</span>
        <Switch
          :checked="showMultiScreen"
          @change="(v) => (showMultiScreen = v)"
        />
      </div>
      <MultiScreenCompare
        v-if="showMultiScreen"
        :players="multiPlayers"
        :height="300"
      />
    </Card>
  </Page>
</template>
