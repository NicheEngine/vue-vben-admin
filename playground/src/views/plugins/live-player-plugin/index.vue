<script lang="ts" setup>
import type { LivePlayerProps } from '@vben/live-player';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Hls, LiveType, Mpegts, useLivePlayer } from '@vben/live-player';

import { Alert, Button, Card, Select, Switch, Tag } from 'antdv-next';

import {
  createLiveAdapter,
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

defineOptions({ name: 'LivePlayerPluginExample' });

// ============================================================
// 一、依赖库加载检测 (hls.js / mpegts.js)
// ============================================================
const hlsReady = ref(false);
const mpegtsReady = ref(false);

const librariesReady = computed(() => hlsReady.value && mpegtsReady.value);

async function checkLibraries() {
  hlsReady.value = !!Hls && typeof Hls.isSupported === 'function';
  mpegtsReady.value = !!Mpegts && typeof Mpegts.getFeatureList === 'function';
}

const packageDependenciesConfig = ` "dependencies": {
    "@vben/live-player": "workspace:*",
},`;

// ============================================================
// 二、默认参数与播放器实例
// ============================================================
const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const lastUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);

const config = reactive<
  Pick<LivePlayerProps, 'autoplay' | 'controls' | 'type'>
>({
  autoplay: true,
  controls: true,
  type: undefined,
});

const [Player, api] = useLivePlayer({
  // -1: 无限重试，0：不重试，3：默认重试3次
  mpegtsMaxRetry: -1,
  onError: (err) => {
    console.warn('[live] player error:', err.message);
  },
});

const player = createLiveAdapter(api);

const isCleared = ref(false);
const playerKey = ref(0);
const showStatus = ref(true);

const effectiveType = computed(() => {
  if (config.type) return config.type;
  if (!currentUrl.value) return '-';
  return currentUrl.value.includes('.m3u8') ? 'hls' : 'mpegts';
});

// ============================================================
// 三、多屏对比开关
// ============================================================
const showMultiScreen = ref(false);

const multiPlayers = computed(() => {
  if (!showMultiScreen.value || !currentUrl.value) return [];

  const modes = [
    { mode: 0 as const, label: '拉伸填满', fit: 'fill' as const },
    { mode: 1 as const, label: '等比留黑边', fit: 'contain' as const },
    { mode: 2 as const, label: '等比裁切', fit: 'cover' as const },
  ] as const;

  return modes.map(({ mode, label, fit }) => {
    const [Player, api] = useLivePlayer({
      autoplay: true,
      muted: true,
      controls: false,
      type: config.type,
    });

    return {
      component: Player,
      props: {
        api,
        url: currentUrl.value,
        'object-fit': fit,
      },
      onDestroy: () => api.destroy(),
      mode,
      label,
    };
  });
});

// ============================================================
// 四、交互
// ============================================================
function applyUrl(u?: string) {
  const value = (u ?? inputUrl.value).trim();
  if (!value) return;
  currentUrl.value = value;
  lastUrl.value = value;
  isCleared.value = false;
  playerKey.value++;

  const history = urlHistory.value.filter((h) => h !== value);
  history.unshift(value);
  urlHistory.value = history.slice(0, 10);
}

function resetUrl() {
  inputUrl.value = DEFAULT_URL;
  currentUrl.value = DEFAULT_URL;
  lastUrl.value = DEFAULT_URL;
  urlHistory.value = [];
  isCleared.value = false;
  playerKey.value++;
  api.pause();
  api.setUrl('');
}

function handleToggle() {
  if (isCleared.value) {
    isCleared.value = false;
    if (lastUrl.value) {
      currentUrl.value = lastUrl.value;
      playerKey.value++;
      setTimeout(() => api.play(), 100);
    }
    return;
  }

  const v = api.video;
  if (!v) return;

  if (v.paused) {
    v.play().catch(console.warn);
    api.updatePlaying(true);
    api.setLoading?.(false);
  } else {
    v.pause();
    api.updatePlaying(false);
  }
}

function handleReload() {
  isCleared.value = false;
  playerKey.value++;

  const target = currentUrl.value || lastUrl.value;
  if (!target) return;

  api.setLoading?.(false);
  currentUrl.value = '';
  setTimeout(() => {
    currentUrl.value = target;
    api.play();
    setTimeout(() => api.setLoading?.(false), 500);
  }, 50);
}

function handleRetry() {
  isCleared.value = false;
  if (currentUrl.value) {
    api.setError(null);
    playerKey.value++;
    api.setUrl(currentUrl.value);
    setTimeout(() => api.play(), 100);
  }
}

function handleMuteChange(checked: boolean) {
  api.setMuted(checked);
}

function handleVolumeChange(value: number) {
  api.setVolume(value);

  const v = api.video;
  if (v) {
    v.volume = value;
    if (value === 0) {
      v.muted = true;
      api.setMuted(true);
    } else if (v.muted) {
      v.muted = false;
      api.setMuted(false);
    }
  }
}

function handleScreenshot(): string {
  const result = player.screenshot?.();
  return typeof result === 'string' ? result : '';
}

function handleClear() {
  isCleared.value = true;
  api.pause();
  api.updatePlaying(false);
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  player.setScaleMode?.(mode);
}

// ============================================================
// 五、生命周期
// ============================================================
onMounted(async () => {
  await checkLibraries();
  api.setMuted(true);
});

onBeforeUnmount(() => {
  void api.destroy();
});
</script>

<template>
  <Page title="LivePlayer 播放器">
    <template #description>
      <div class="mt-2 text-foreground/80">
        LivePlayer 基于 hls.js 与 mpegts.js，支持 HLS（.m3u8）与 HTTP-FLV /
        WebSocket-FLV。
      </div>
    </template>

    <!-- ===== 依赖缺失时的占位页面 ===== -->
    <template v-if="!librariesReady">
      <Alert
        v-if="!hlsReady"
        type="warning"
        show-icon
        class="mb-4"
        message="未检测到 hls.js 库"
        description="请确保 @vben/live-player 的依赖项中已包含 hls.js 并已正确安装。"
      >
        <template #action>
          <Button size="small" @click="checkLibraries">重新检测</Button>
        </template>
      </Alert>

      <Alert
        v-if="!mpegtsReady"
        type="warning"
        show-icon
        class="mb-4"
        message="未检测到 mpegts.js 库"
        description="请确保 @vben/live-player 的依赖项中已包含 mpegts.js 并已正确安装。"
      >
        <template #action>
          <Button size="small" @click="checkLibraries">重新检测</Button>
        </template>
      </Alert>
      <Card v-if="!librariesReady" class="mb-4" title="package.json 配置参考">
        <div class="text-sm text-foreground/80">
          在
          <code class="rounded bg-muted px-1 py-0.5 text-xs">package.json</code>
          的
          <code class="rounded bg-muted px-1 py-0.5 text-xs">dependencies</code>
          中加入下列依赖：
        </div>
        <pre
          class="mt-3 overflow-auto rounded-xl border border-border bg-muted p-4 text-xs"
        ><code>{{ packageDependenciesConfig }}</code></pre>
      </Card>
    </template>

    <!-- ===== 库就绪时展示原有完整页面 ===== -->
    <template v-else>
      <!-- ===== 播放地址 ===== -->
      <Card class="mb-4" title="播放地址">
        <ProtocolDetect
          v-model="inputUrl"
          placeholder="ws://...flv / http://...flv / https://...m3u8"
          @apply="applyUrl"
          @reset="resetUrl"
        />
        <div class="mt-2 text-xs text-foreground/50">
          当前地址：{{ currentUrl || '（空）' }} | 推断类型：
          <Tag color="blue">{{ effectiveType }}</Tag>
        </div>
        <div v-if="urlHistory.length > 0" class="mt-3">
          <div class="mb-2 text-xs text-foreground/60">最近播放：</div>
          <div class="flex flex-wrap gap-2">
            <Tag
              v-for="item in urlHistory"
              :key="item"
              class="cursor-pointer"
              @click="
                () => {
                  inputUrl = item;
                  applyUrl(item);
                }
              "
            >
              {{ item.length > 60 ? `${item.slice(0, 60)}…` : item }}
            </Tag>
          </div>
        </div>
      </Card>

      <!-- ✅ 替换：使用 PlayerSizeCard 包裹播放器 -->
      <PlayerSizeCard
        class="mb-4"
        :video-width="player.videoWidth.value"
        :video-height="player.videoHeight.value"
        :player="player"
        :show-status="showStatus"
        :is-cleared="isCleared"
      >
        <Player
          v-if="currentUrl && !isCleared"
          :key="playerKey"
          :url="currentUrl"
          :autoplay="config.autoplay"
          :controls="config.controls"
          :muted="player.isMuted.value"
          :type="config.type"
          class="h-full w-full absolute inset-0"
        />

        <!-- 清除后的占位层 -->
        <div
          v-if="!currentUrl && !isCleared"
          class="absolute inset-0 flex items-center justify-center text-foreground/40 text-sm"
        >
          暂无视频源
        </div>
        <div
          v-if="isCleared"
          class="absolute inset-0 bg-black flex items-center justify-center z-10"
        >
          <span class="text-foreground/40 text-sm">画面已清除</span>
        </div>
        <PlayerErrorOverlay
          :error="player.error.value"
          :is-reconnecting="player.isLoading.value"
          @retry="handleRetry"
        />
      </PlayerSizeCard>

      <!-- ===== 播放状态面板 ===== -->
      <PlayStatusPanel class="mb-4" :player="player" />

      <PlayerControlCard
        class="mb-4"
        :player="player"
        :is-cleared="isCleared"
        @toggle="handleToggle"
        @reload="handleReload"
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
              <span class="text-sm">控件：</span>
              <Switch v-model:checked="config.controls" />
            </div>
            <div class="flex items-center gap-2 whitespace-nowrap">
              <span class="text-sm">强制类型：</span>
              <Select
                v-model:value="config.type"
                class="w-32"
                allow-clear
                placeholder="自动"
                :options="[
                  { label: '自动', value: undefined },
                  { label: 'HLS', value: LiveType.HLS },
                  { label: 'MPEGTS', value: LiveType.MPEGTS },
                ]"
              />
            </div>
            <div class="flex items-center gap-2 whitespace-nowrap">
              <span class="text-sm">状态标签：</span>
              <Switch v-model:checked="showStatus" />
            </div>
          </div>
        </template>
      </PlayerControlCard>

      <!-- ===== 网络质量实时曲线 ===== -->
      <Card class="mb-4" title="网络质量实时曲线">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <NetworkChart
            :value="(player.stats.value?.vbps || 0) / 8 / 1024"
            label="实时码率"
            unit="kB/s"
            color="#22c55e"
          />
          <NetworkChart
            :value="player.networkDelay.value || 0"
            label="网络延迟 (buf)"
            unit="ms"
            color="#f59e0b"
          />
        </div>
      </Card>

      <!-- ===== 录制面板 ===== -->
      <template
        v-if="
          player.capabilities.record &&
          player.startRecord &&
          player.stopRecordAndSave
        "
      >
        <RecordPanel
          class="mb-4"
          :is-recording="player.isRecording.value"
          :recording-duration="player.recordingDuration.value"
          :start-record="player.startRecord"
          :stop-record-and-save="player.stopRecordAndSave"
          :can-record="player.isPlaying.value"
        />
      </template>

      <!-- ===== 截图预览 ===== -->
      <template v-if="player.capabilities.screenshot && player.screenshot">
        <ScreenshotPreview class="mb-4" :capture="handleScreenshot" />
      </template>

      <!-- ===== 多屏对比 ===== -->
      <Card class="mb-4" title="多屏对比">
        <div class="mb-3 flex items-center gap-3">
          <span class="text-sm">启用：</span>
          <Switch
            :checked="showMultiScreen"
            @change="(val) => (showMultiScreen = val)"
          />
        </div>
        <MultiScreenCompare
          v-if="showMultiScreen"
          :players="multiPlayers"
          :height="300"
          :type="config.type"
        />
      </Card>
    </template>
  </Page>
</template>
