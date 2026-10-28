<script lang="ts" setup>
import type { JessibucaConfig } from '@vben/jessibuca-player';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { Page } from '@vben/common-ui';
import { useJessibucaPlayer } from '@vben/jessibuca-player';

import {
  Alert,
  Button,
  Card,
  InputNumber,
  Select,
  SpaceAddon,
  SpaceCompact,
  Switch,
  Tag,
} from 'antdv-next';

import {
  createJessibucaAdapter,
  NetworkChart,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';
import MultiScreenCompare from './components/multi-screen-compare.vue';

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

const [Player, jessibucaApi] = useJessibucaPlayer({ config });
const player = createJessibucaAdapter(jessibucaApi);

// ============================================================
// 三、画面尺寸与比例控制
// ============================================================
type SizeMode = 'auto' | 'fixed' | 'ratio';
const sizeMode = ref<SizeMode>('auto');
const fixedWidth = ref(800);
const fixedHeight = ref(450);

const DEFAULT_RATIO = { label: '16 : 9（宽屏）', value: '16:9', w: 16, h: 9 };
const ratioOptions = [
  DEFAULT_RATIO,
  { label: '4 : 3（传统）', value: '4:3', w: 4, h: 3 },
  { label: '21 : 9（超宽）', value: '21:9', w: 21, h: 9 },
  { label: '1 : 1（方形）', value: '1:1', w: 1, h: 1 },
  { label: '9 : 16（竖屏）', value: '9:16', w: 9, h: 16 },
  { label: '3 : 4（竖屏）', value: '3:4', w: 3, h: 4 },
];
const ratio = ref('16:9');
const ratioBaseWidth = ref(960);

const containerStyle = computed(() => {
  if (sizeMode.value === 'fixed')
    return { width: `${fixedWidth.value}px`, height: `${fixedHeight.value}px` };
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    const height = Math.round((ratioBaseWidth.value * opt.h) / opt.w);
    return { width: `${ratioBaseWidth.value}px`, height: `${height}px` };
  }
  return { width: '100%', height: '480px' };
});

const containerRatio = computed(() => {
  if (sizeMode.value === 'fixed')
    return fixedHeight.value
      ? (fixedWidth.value / fixedHeight.value).toFixed(2)
      : '-';
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    return (opt.w / opt.h).toFixed(2);
  }
  return '-';
});

const videoRatio = computed(() => {
  if (!player.videoWidth.value || !player.videoHeight.value) return '-';
  return (player.videoWidth.value / player.videoHeight.value).toFixed(2);
});

const SCALE_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '拉伸填满',
  1: '等比留黑边',
  2: '等比裁切',
};
const scaleModeLabel = computed(
  () => SCALE_MODE_LABELS[player.scaleMode.value],
);

// ============================================================
// 四、多屏对比开关
// ============================================================
const showMultiScreen = ref(false);

// ============================================================
// 五、交互
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
  void jessibucaApi.clearView();
}

function handleToggle() {
  if (isCleared.value) {
    isCleared.value = false;
    void jessibucaApi.play();
    return;
  }
  if (player.isPlaying.value) {
    void jessibucaApi.pause();
  } else {
    void jessibucaApi.play();
  }
}

function handleReload() {
  isCleared.value = false;
  player.setLoading?.(true);
  void jessibucaApi.play();
}

function handleFullscreen() {
  const wrapper = document.querySelector('.jessibuca-player-wrapper');
  const el = wrapper?.parentElement;
  if (!el) return;

  if (document.fullscreenElement) {
    document
      .exitFullscreen()
      .then(() => {
        nextTick(() => setTimeout(() => jessibucaApi.resize(), 100));
      })
      .catch(console.warn);
  } else {
    el.requestFullscreen()
      .then(() => {
        nextTick(() => setTimeout(() => jessibucaApi.resize(), 100));
      })
      .catch(console.warn);
  }
}

function handleFullscreenChange() {
  nextTick(() => setTimeout(() => jessibucaApi.resize(), 100));
}

function handleMuteChange(checked: boolean) {
  config.isMute = checked;
  checked ? jessibucaApi.mute() : jessibucaApi.cancelMute();
}

function handleVolumeChange(value: number) {
  config.volume = value;
  jessibucaApi.setVolume(value);
  if (value === 0) {
    config.isMute = true;
    jessibucaApi.mute();
  } else if (config.isMute) {
    config.isMute = false;
    jessibucaApi.cancelMute();
  }
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  config.scaleMode = mode;
  jessibucaApi.setScaleMode(mode);
}

function handleScreenshot(): string {
  const result = jessibucaApi.screenshot();
  return typeof result === 'string' ? result : '';
}

function handleClear() {
  isCleared.value = true;
  void jessibucaApi.clearView();
}

function handleStartRecord() {
  jessibucaApi.startRecord(`jessibuca-${Date.now()}`, 'webm');
}

watch([sizeMode, fixedWidth, fixedHeight, ratio, ratioBaseWidth], () => {
  if (!jessibucaReady.value) return;
  nextTick(() => setTimeout(() => jessibucaApi.resize(), 50));
});

// 添加一个全局的解锁方法
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
// 六、生命周期
// ============================================================
onMounted(async () => {
  await runFullCheck();
  if (!jessibucaReady.value) startPolling();

  setTimeout(() => jessibucaApi.mute(), 1000);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('click', unlockAudioContext, { once: true });
});

onBeforeUnmount(() => {
  if (checkTimer) clearInterval(checkTimer);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('click', unlockAudioContext);
  void jessibucaApi.destroy();
});
</script>

<template>
  <Page title="Jessibuca 播放器">
    <template #description>
      <div class="mt-2 text-foreground/80">
        Jessibuca 是一个纯 JavaScript 的 FLV / HLS 流媒体播放器。
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
<Button size="small" @click="recheckJessibuca">
重新检测
</Button>
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

      <Card class="mb-4" title="播放器">
        <template #extra>
          <span v-if="player.isLoading.value" class="text-xs text-orange-500">加载中...</span>
          <span v-else-if="player.error.value" class="text-xs text-red-500">错误：{{ player.error.value }}</span>
          <span
            v-else-if="player.isPlaying.value && !isCleared"
            class="text-xs text-green-500"
            >播放中</span>
        </template>

        <div class="flex justify-center">
          <div
            class="overflow-hidden rounded-xl border border-border bg-black relative"
            :style="containerStyle"
          >
            <Player
              :api="jessibucaApi"
              :url="currentUrl"
              :config="config"
              class="h-full w-full"
            />
            <div
              v-if="isCleared"
              class="absolute inset-0 bg-black flex items-center justify-center z-10"
            >
              <span class="text-foreground/40 text-sm">画面已清除</span>
            </div>
          </div>
        </div>
      </Card>

      <PlayStatusPanel class="mb-4" :player="player" />

      <Card class="mb-4" title="画面尺寸">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm">尺寸模式：</span>
          <Select
            v-model:value="sizeMode"
            class="w-40"
            :options="[
              { label: '自适应', value: 'auto' },
              { label: '固定宽高', value: 'fixed' },
              { label: '固定比例', value: 'ratio' },
            ]"
          />
          <span class="ml-2 text-xs text-foreground/50">容器比例：{{ containerRatio }} | 视频比例：{{ videoRatio }}</span>
        </div>

        <div
          v-if="sizeMode === 'fixed'"
          class="mt-4 flex flex-wrap items-center gap-3"
        >
          <span class="text-sm">宽：</span>
          <!-- 👈 恢复 SpaceCompact 包装 -->
          <SpaceCompact>
            <InputNumber v-model:value="fixedWidth" :min="160" :max="3840" />
            <SpaceAddon>px</SpaceAddon>
          </SpaceCompact>
          <span class="ml-2 text-sm">高：</span>
          <SpaceCompact>
            <InputNumber v-model:value="fixedHeight" :min="90" :max="2160" />
            <SpaceAddon>px</SpaceAddon>
          </SpaceCompact>
          <Button
            size="small"
            @click="
              () => {
                fixedWidth = 1280;
                fixedHeight = 720;
              }
            "
            >
1280 × 720
</Button>
          <Button
            size="small"
            @click="
              () => {
                fixedWidth = 1920;
                fixedHeight = 1080;
              }
            "
            >
1920 × 1080
</Button>
        </div>

        <div
          v-if="sizeMode === 'ratio'"
          class="mt-4 flex flex-wrap items-center gap-3"
        >
          <span class="text-sm">比例：</span>
          <Select v-model:value="ratio" class="w-40" :options="ratioOptions" />
          <span class="ml-2 text-sm">宽度：</span>
          <SpaceCompact>
            <InputNumber
              v-model:value="ratioBaseWidth"
              :min="160"
              :max="3840"
            />
            <SpaceAddon>px</SpaceAddon>
          </SpaceCompact>
          <span class="text-xs text-foreground/50">高度按比例自动计算</span>
        </div>
      </Card>

      <Card class="mb-4" title="播放控制">
        <div class="flex flex-wrap items-center gap-3">
          <Button @click="handleToggle">
{{
            player.isPlaying.value && !isCleared ? '暂停' : '播放'
          }}
</Button>
          <Button @click="handleReload">重新加载</Button>
          <Button @click="handleFullscreen">全屏播放</Button>
          <Button @click="handleClear">清除画面</Button>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm">静音：</span>
            <Switch
              :checked="player.isMuted.value"
              @change="handleMuteChange"
            />
          </div>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm shrink-0">音量：</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="player.volume.value"
              class="w-40 shrink-0"
              @input="
                (e) =>
                  handleVolumeChange(
                    Number((e.target as HTMLInputElement).value),
                  )
              "
            />
            <span class="text-xs text-foreground/50 w-10 text-right shrink-0">{{ Math.round(player.volume.value * 100) }}%</span>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <span class="text-sm shrink-0">缩放模式：</span>
          <Button
            v-for="mode in [0, 1, 2]"
            :key="mode"
            :type="player.scaleMode.value === mode ? 'primary' : 'default'"
            size="small"
            @click="handleScaleModeChange(mode as 0 | 1 | 2)"
          >
            {{ mode === 0 ? '拉伸' : mode === 1 ? '等比留黑边' : '等比裁切' }}
          </Button>
          <Tag color="blue">{{ scaleModeLabel }}</Tag>
        </div>
      </Card>

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
          :url="currentUrl"
          :width="320"
          :height="180"
        />
      </Card>
    </template>
  </Page>
</template>
