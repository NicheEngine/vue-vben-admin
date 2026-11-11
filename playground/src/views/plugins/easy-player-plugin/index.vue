<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useEasyPlayer } from '@vben/easy-player';

import { Alert, Button, Card, Switch, Tag } from 'antdv-next';

import {
  createEasyAdapter,
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

defineOptions({ name: 'EasyPlayerPluginExample' });

// ============================================================
// 一、库加载检测
// ============================================================
const easyPlayerReady = ref(false);

function checkEasyPlayer() {
  return (
    typeof window !== 'undefined' &&
    window.customElements !== undefined &&
    !!window.customElements.get('easy-player')
  );
}

let checkTimer: null | ReturnType<typeof setInterval> = null;
function startPolling() {
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = null;
  let count = 0;
  checkTimer = setInterval(() => {
    count += 1;
    if (checkEasyPlayer()) {
      easyPlayerReady.value = true;
      if (checkTimer) clearInterval(checkTimer);
      checkTimer = null;
    } else if (count > 15) {
      if (checkTimer) clearInterval(checkTimer);
      checkTimer = null;
    }
  }, 200);
}

function recheckEasyPlayer() {
  easyPlayerReady.value = checkEasyPlayer();
  if (!easyPlayerReady.value) startPolling();
}

const easyPlayerViteConfig = `application: { depend: true, dependOptions: { build: true, serve: true, depends: { easyplayer: { source: '../libraries/easyplayer' } } } },`;

// ============================================================
// 二、播放器实例与配置
// ============================================================
const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);
const isCleared = ref(false);
const showStatus = ref(true);
const showControlBar = ref(true);

const config = reactive<{ autoplay: boolean; muted: boolean }>({
  autoplay: true,
  muted: true,
});

const keepPlayingOffscreen = ref(true);

const [Player, api] = useEasyPlayer({
  onError: (err: any) => {
    console.warn('[easy] player error:', err);
  },
});

const player = createEasyAdapter(api);

// ============================================================
// 三、多屏对比开关
// ============================================================
const showMultiScreen = ref(false);

const multiPlayers = computed(() => {
  // 如果没开启，或者没有 URL，就不创建实例，节约资源
  if (!showMultiScreen.value || !currentUrl.value) return [];

  const modes = [
    { mode: 0 as const, label: '拉伸填满', scaleMode: 0 },
    { mode: 1 as const, label: '等比留黑边', scaleMode: 1 },
    { mode: 2 as const, label: '等比裁切', scaleMode: 2 },
  ] as const;

  return modes.map(({ mode, label, scaleMode }) => {
    const [Player, api] = useEasyPlayer({
      autoplay: true,
      muted: true,
      videoUrl: currentUrl.value,
      scaleMode,
      hasAudio: false,
      showEnterprise: false,
      showCustomButton: false,
      debug: false,
    });

    return {
      component: Player,
      props: {
        'player-api': api,
        'video-url': currentUrl.value,
        'scale-mode': scaleMode,
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
  isCleared.value = false;
  currentUrl.value = value;
  const history = urlHistory.value.filter((h) => h !== value);
  history.unshift(value);
  urlHistory.value = history.slice(0, 10);
  api.setUrl(value);
}

function resetUrl() {
  inputUrl.value = DEFAULT_URL;
  currentUrl.value = DEFAULT_URL;
  urlHistory.value = [];
  isCleared.value = false;
  api.destroy();
}

function handleToggle() {
  if (isCleared.value) {
    isCleared.value = false;
    if (currentUrl.value) api.setUrl(currentUrl.value);
    return;
  }
  api.toggle();
}

function handleReload() {
  isCleared.value = false;
  if (currentUrl.value) api.replay();
}

function handleRetry() {
  isCleared.value = false;
  if (currentUrl.value) {
    api.setUrl(currentUrl.value);
  }
}

function handleMuteChange(checked: boolean) {
  config.muted = checked;
  api.setMuted(checked);
}

function handleVolumeChange(value: number) {
  api.setVolume(value);
  if (value === 0 && !config.muted) {
    config.muted = true;
    api.setMuted(true);
  } else if (value > 0 && config.muted) {
    config.muted = false;
    api.setMuted(false);
  }
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  player.setScaleMode?.(mode);
  api.setScaleMode(mode);
}

function handleScreenshot(): string {
  const result = player.screenshot?.();
  return typeof result === 'string' ? result : '';
}

function handleClear() {
  isCleared.value = true;
  api.pause();
}

// ============================================================
// 五、生命周期
// ============================================================
onMounted(() => {
  easyPlayerReady.value = checkEasyPlayer();
  if (!easyPlayerReady.value) startPolling();
});

onBeforeUnmount(() => {
  if (checkTimer) clearInterval(checkTimer);
  void player.destroy();
});
</script>

<template>
  <Page title="EasyPlayer 播放器">
    <template #description>
      <div class="mt-2 text-foreground/80">
        EasyPlayer 是一个支持 HTTP-FLV、HLS 的高性能播放器（底层原生暂不支持
        WebRTC）。
      </div>
    </template>

    <Alert
      v-if="!easyPlayerReady"
      type="error"
      show-icon
      class="mb-4"
      message="未检测到 EasyPlayer 库"
      description="请确认 <easy-player> 自定义元素已注册（脚本已加载）。"
    >
      <template #action>
        <Button size="small" @click="recheckEasyPlayer">重新检测</Button>
      </template>
    </Alert>

    <Card v-if="!easyPlayerReady" class="mb-4" title="vite.config.ts 配置参考">
      <div class="text-sm text-foreground/80">加入下列配置：</div>
      <pre
        class="mt-3 overflow-auto rounded-xl border border-border bg-muted p-4 text-xs"
      ><code>{{ easyPlayerViteConfig }}</code></pre>
    </Card>

    <template v-if="easyPlayerReady">
      <Card class="mb-4" title="播放地址">
        <ProtocolDetect
          v-model="inputUrl"
          placeholder="http://...flv 或 http://...m3u8"
          @apply="applyUrl"
          @reset="resetUrl"
        />
        <div class="mt-2 text-xs text-foreground/50">
          当前地址：{{ currentUrl || '（空）' }}
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
          :show-control-bar="showControlBar"
          :player-api="api"
          :video-url="currentUrl"
          :scale-mode="player.scaleMode.value"
          :keep-playing-offscreen="keepPlayingOffscreen"
          :autoplay="config.autoplay"
          :muted="config.muted"
          class="h-full w-full absolute inset-0"
        />
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

      <PlayStatusPanel class="mb-4" :player="player" />

      <!-- ✅ 替换：使用 PlayerControlCard -->
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
              <span class="text-sm">工具栏：</span>
              <Switch v-model:checked="showControlBar" />
            </div>
            <div class="flex items-center gap-2 whitespace-nowrap">
              <span class="text-sm">状态标签：</span>
              <Switch v-model:checked="showStatus" />
            </div>
            <div class="flex items-center gap-2 whitespace-nowrap">
              <span class="text-sm">离屏继续播放：</span>
              <Switch v-model:checked="keepPlayingOffscreen" />
            </div>
            <span class="text-xs text-foreground/50">开启后，滚动出屏幕将不会被底层自动暂停。</span>
          </div>
        </template>
      </PlayerControlCard>

      <Card class="mb-4" title="网络质量实时曲线">
        <div
          v-if="!player.capabilities.stats"
          class="text-sm text-foreground/50 py-4 text-center"
        >
          当前播放器 (EasyPlayer) 基于原生 Video 标签，暂不支持 RTP
          网络质量统计。
        </div>

        <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          :start-record="player.startRecord!"
          :stop-record-and-save="player.stopRecordAndSave!"
          :can-record="player.isPlaying.value"
        />
      </template>

      <template v-if="player.capabilities.screenshot && player.screenshot">
        <ScreenshotPreview class="mb-4" :capture="handleScreenshot" />
      </template>

      <Card class="mb-4" title="多屏对比">
        <div class="mb-3 flex flex-wrap items-center gap-3">
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
        />
      </Card>
    </template>
  </Page>
</template>
