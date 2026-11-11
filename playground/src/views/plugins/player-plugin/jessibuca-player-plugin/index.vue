<script lang="ts" setup>
import type { JessibucaConfig } from '@vben/jessibuca-player';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';

import { Page } from '@vben/common-ui';
import { useJessibucaPlayer } from '@vben/jessibuca-player';

import { Alert, Button, Card, Switch, Tag } from 'antdv-next';

import {
  createJessibucaAdapter,
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

defineOptions({ name: 'JessibucaPluginExample' });

// ============================================================
// 一、库加载与静态资源校验
// ============================================================
const jessibucaReady = ref(false);
const decoderJsOk = ref<boolean | null>(null);
const decoderWasmOk = ref<boolean | null>(null);

function checkJessibuca() {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).Jessibuca === 'function'
  );
}

async function checkStatic(url: string) {
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    return resp.ok;
  } catch {
    return false;
  }
}

async function runFullCheck() {
  jessibucaReady.value = checkJessibuca();
  if (jessibucaReady.value) {
    const [js, wasm] = await Promise.all([
      checkStatic('/jessibuca/decoder.js'),
      checkStatic('/jessibuca/decoder.wasm'),
    ]);
    decoderJsOk.value = js;
    decoderWasmOk.value = wasm;
  }
}

let checkTimer: null | ReturnType<typeof setInterval> = null;
function startPolling() {
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = null;
  let count = 0;
  checkTimer = setInterval(async () => {
    count += 1;
    if (checkJessibuca()) {
      if (checkTimer) clearInterval(checkTimer);
      checkTimer = null;
      await runFullCheck();
    } else if (count > 15) {
      if (checkTimer) clearInterval(checkTimer);
      checkTimer = null;
    }
  }, 200);
}

async function recheckJessibuca() {
  decoderJsOk.value = null;
  decoderWasmOk.value = null;
  await runFullCheck();
  if (!jessibucaReady.value) startPolling();
}

const jessibucaViteConfig = `application: { depend: true, dependOptions: { build: true, serve: true, depends: { jessibuca: { source: '../libraries/jessibuca' } } } },`;

const decoderJsStatus = computed(() =>
  decoderJsOk.value === false ? '缺失' : '正常',
);
const decoderWasmStatus = computed(() =>
  decoderWasmOk.value === false ? '缺失' : '正常',
);

// ============================================================
// 二、播放器实例与配置
// ============================================================
const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);
const isCleared = ref(false);
const showStatus = ref(true);

const config = reactive<JessibucaConfig>({
  autoPlay: true,
  isMute: true,
  debug: false,
  decoder: '/jessibuca/decoder.js',
  timeout: 10,
  videoBuffer: 0.5,
  isResize: true,
  scaleMode: 1,
  supportDblclickFullscreen: true,
  useWebFullScreen: false,
  enableRecording: true,
  recordType: 'webm',
  loadingTimeoutReplay: false,
  heartTimeoutReplay: false,
  loadingTimeoutReplayTimes: 0,
  heartTimeoutReplayTimes: 0,
});

const [Player, api] = useJessibucaPlayer({ config });
const player = createJessibucaAdapter(api);

// ============================================================
// 三、多屏对比开关
// ============================================================
const showMultiScreen = ref(false);
const multiPlayers = computed(() => {
  if (!showMultiScreen.value || !currentUrl.value) return [];

  const modes = [
    { mode: 0 as const, label: '拉伸填满', scaleMode: 0 },
    { mode: 1 as const, label: '等比留黑边', scaleMode: 1 },
    { mode: 2 as const, label: '等比裁切', scaleMode: 2 },
  ] as const;

  return modes.map(({ mode, label, scaleMode }) => {
    const [Player, api] = useJessibucaPlayer({
      config: {
        autoPlay: true,
        isMute: true,
        decoder: '/jessibuca/decoder.js',
        scaleMode,
        isResize: true,
        supportDblclickFullscreen: false,
        useWebFullScreen: false,
        enableRecording: false,
        debug: false,
        forceNoOffscreen: true,
      },
    });

    return {
      component: Player,
      props: {
        api,
        url: currentUrl.value,
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
}

function resetUrl() {
  inputUrl.value = DEFAULT_URL;
  currentUrl.value = DEFAULT_URL;
  urlHistory.value = [];
  isCleared.value = false;
  void api.destroy();
}

function handleToggle() {
  if (isCleared.value) {
    isCleared.value = false;
    void api.play();
    return;
  }
  if (player.isPlaying.value) {
    void api.pause();
  } else {
    void api.play();
  }
}

function handleReload() {
  isCleared.value = false;
  player.setLoading?.(true);
  void api.play();
}

function handleRetry() {
  isCleared.value = false;
  if (currentUrl.value) {
    player.setUrl(currentUrl.value);
  }
}

function handleMuteChange(checked: boolean) {
  config.isMute = checked;
  checked ? api.mute() : api.cancelMute();
}

function handleVolumeChange(value: number) {
  config.volume = value;
  api.setVolume(value);
  if (value === 0) {
    config.isMute = true;
    api.mute();
  } else if (config.isMute) {
    config.isMute = false;
    api.cancelMute();
  }
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  config.scaleMode = mode;
  api.setScaleMode(mode);
}

function handleScreenshot(): string {
  const result = api.screenshot();
  return typeof result === 'string' ? result : '';
}

function handleClear() {
  isCleared.value = true;
  void api.clearView();
}

function handleStartRecord() {
  api.startRecord(`jessibuca-${Date.now()}`, 'webm');
}

// ✅ 新增：当尺寸组件发生变化时，触发 Jessibuca 的 resize
function handleSizeResize() {
  if (!jessibucaReady.value) return;
  nextTick(() => setTimeout(() => api.resize(), 50));
}

function unlockAudioContext() {
  const AudioCtx =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch((error: unknown) => {
        console.warn('Failed to resume AudioContext:', error);
      });
    }
  } catch (error: unknown) {
    console.warn('Failed to create AudioContext:', error);
  }
}

// ============================================================
// 五、生命周期
// ============================================================
onMounted(async () => {
  await runFullCheck();
  if (!jessibucaReady.value) startPolling();

  setTimeout(() => api.mute(), 1000);
  document.addEventListener('click', unlockAudioContext, { once: true });
});

onBeforeUnmount(() => {
  if (checkTimer) clearInterval(checkTimer);
  document.removeEventListener('click', unlockAudioContext);
  void api.destroy();
});
</script>

<template>
  <Page title="Jessibuca 播放器">
    <template #description>
      <div class="mt-2 text-foreground/80">
        Jessibuca 是一个纯 JavaScript 的 FLV 流媒体播放器。
      </div>
    </template>

    <Alert
      v-if="!jessibucaReady"
      type="error"
      show-icon
      class="mb-4"
      message="未检测到 Jessibuca 库"
      description="请确认静态资源加载。"
    >
      <template #action>
        <Button size="small" @click="recheckJessibuca"> 重新检测 </Button>
      </template>
    </Alert>

    <Alert
      v-if="
        jessibucaReady && (decoderJsOk === false || decoderWasmOk === false)
      "
      type="warning"
      show-icon
      class="mb-4"
      message="Jessibuca 静态资源缺失"
      :description="`decoder.js: ${decoderJsStatus}，decoder.wasm: ${decoderWasmStatus}。`"
    />

    <Card v-if="!jessibucaReady" class="mb-4" title="vite.config.ts 配置参考">
      <div class="text-sm text-foreground/80">加入下列配置：</div>
      <pre
        class="mt-3 overflow-auto rounded-xl border border-border bg-muted p-4 text-xs"
      ><code>{{ jessibucaViteConfig }}</code></pre>
    </Card>

    <template v-if="jessibucaReady">
      <Card class="mb-4" title="播放地址">
        <ProtocolDetect
          v-model="inputUrl"
          placeholder="ws://...flv / http://...flv"
          @apply="applyUrl"
          @reset="resetUrl"
        />
        <div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span class="text-foreground/50">当前地址：{{ currentUrl || '（空）' }}</span>
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

      <!-- ✅ 替换：使用 PlayerSizeCard 包裹播放器，并监听 resize -->
      <PlayerSizeCard
        class="mb-4"
        :video-width="player.videoWidth.value"
        :video-height="player.videoHeight.value"
        :player="player"
        :show-status="showStatus"
        :is-cleared="isCleared"
        @resize="handleSizeResize"
      >
        <Player
          v-if="currentUrl && !isCleared"
          :api="api"
          :url="currentUrl"
          :config="config"
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
              <Switch v-model:checked="config.autoPlay" />
            </div>
            <div class="flex items-center gap-2 whitespace-nowrap">
              <span class="text-sm">状态标签：</span>
              <Switch v-model:checked="showStatus" />
            </div>
          </div>
        </template>
      </PlayerControlCard>

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
            label="网络延迟 (buf)"
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
          :start-record="handleStartRecord"
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
