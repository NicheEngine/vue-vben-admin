<script lang="ts" setup>
import type { EasyPlayer } from '@vben/easy-player';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useEasyPlayer } from '@vben/easy-player';

import {
  Alert,
  Button,
  Card,
  InputNumber,
  Select,
  Slider,
  SpaceAddon,
  SpaceCompact,
  Switch,
  Tag,
} from 'antdv-next';

import {
  createEasyAdapter,
  NetworkChart,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';
import MultiScreenCompare from './components/multi-screen-compare.vue';

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

const config = reactive<{ autoplay: boolean; muted: boolean }>({
  autoplay: true,
  muted: true,
});

const keepPlayingOffscreen = ref(false);

const [Player, api] = useEasyPlayer({
  onError: (err: any) => {
    console.warn('[easy] player error:', err);
  },
});

const player = createEasyAdapter(api);

const playerRef = ref<InstanceType<typeof EasyPlayer> | null>(null);

// ============================================================
// 三、响应式状态
// ============================================================
const isPlaying = player.isPlaying;
const volume = player.volume;
const muted = player.isMuted;

// ============================================================
// 四、画面尺寸与比例控制
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

const actualAspectRatio = computed(() => {
  if (player.videoWidth.value > 0 && player.videoHeight.value > 0) {
    return `${player.videoWidth.value} / ${player.videoHeight.value}`;
  }
  return '16 / 9';
});

const containerStyle = computed(() => {
  if (sizeMode.value === 'fixed') {
    return { width: `${fixedWidth.value}px`, height: `${fixedHeight.value}px` };
  }
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    const height = Math.round((ratioBaseWidth.value * opt.h) / opt.w);
    return { width: `${ratioBaseWidth.value}px`, height: `${height}px` };
  }
  return {
    width: '100%',
    aspectRatio: actualAspectRatio.value,
    maxHeight: '600px',
  };
});

const containerRatio = computed(() => {
  if (sizeMode.value === 'fixed') {
    return fixedHeight.value
      ? (fixedWidth.value / fixedHeight.value).toFixed(2)
      : '-';
  }
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    return (opt.w / opt.h).toFixed(2);
  }
  return (player.videoWidth.value / player.videoHeight.value || 16 / 9).toFixed(
    2,
  );
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
  () => SCALE_MODE_LABELS[player.scaleMode.value] ?? '未知',
);

// ============================================================
// 五、多屏对比开关
// ============================================================
const showMultiScreen = ref(false);

// ============================================================
// 六、交互
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
  api.destroyPlayer();
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

function handleFullscreen() {
  const el = (playerRef.value?.$el as HTMLElement)?.parentElement;
  if (!el) {
    if (document.fullscreenElement) api.exitFullscreen();
    else api.fullscreen();
    return;
  }

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(console.warn);
  } else {
    el.requestFullscreen().catch(() => {
      api.fullscreen();
    });
  }
}

function handleFullscreenChange() {
  // 底层 ResizeObserver 会自动接管
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
// 七、生命周期
// ============================================================
onMounted(() => {
  easyPlayerReady.value = checkEasyPlayer();
  if (!easyPlayerReady.value) startPolling();

  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onBeforeUnmount(() => {
  if (checkTimer) clearInterval(checkTimer);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

    <Alert
      v-else
      class="mb-4"
      type="info"
      show-icon
      message="基于 @easydarwin/easyplayer 的封装。支持 HTTP-FLV 和 HLS 协议。"
    />

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

      <Card class="mb-4" title="播放器">
        <template #extra>
          <span v-if="player.isLoading.value" class="text-xs text-orange-500">
            加载中...
          </span>
          <span v-else-if="player.error.value" class="text-xs text-red-500">
            错误：{{ player.error.value }}
          </span>
          <span
            v-else-if="player.isPlaying.value && !isCleared"
            class="text-xs text-green-500"
          >
            播放中
          </span>
        </template>

        <div class="flex justify-center w-full">
          <div
            class="overflow-hidden rounded-xl border border-border bg-black relative w-full"
            :style="containerStyle"
          >
            <Player
              v-if="currentUrl"
              ref="playerRef"
              :player-api="api"
              :video-url="currentUrl"
              :scale-mode="player.scaleMode.value"
              :keep-playing-offscreen="keepPlayingOffscreen"
              :autoplay="config.autoplay"
              :muted="muted"
              class="h-full w-full absolute inset-0"
            />
            <div
              v-if="!currentUrl"
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
          <span class="ml-2 text-xs text-foreground/50">
            容器比例：{{ containerRatio }} | 视频比例：{{ videoRatio }}
          </span>
        </div>

        <div
          v-if="sizeMode === 'fixed'"
          class="mt-4 flex flex-wrap items-center gap-3"
        >
          <span class="text-sm">宽：</span>
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
        <div v-if="sizeMode === 'auto'" class="mt-2 text-xs text-foreground/50">
          自适应模式：宽度 100%，高度根据视频源比例自动撑开。
        </div>
      </Card>

      <Card class="mb-4" title="播放控制">
        <div class="flex flex-wrap items-center gap-3">
          <Button @click="handleToggle">
            {{ isPlaying && !isCleared ? '暂停' : '播放' }}
          </Button>
          <Button @click="handleReload">重新加载</Button>
          <Button @click="handleFullscreen">全屏播放</Button>
          <Button @click="handleClear">清除画面</Button>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm">静音：</span>
            <Switch :checked="muted" @change="handleMuteChange" />
          </div>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm shrink-0">音量：</span>
            <Slider
              class="w-40 shrink-0"
              :min="0"
              :max="1"
              :step="0.01"
              :value="volume"
              @change="handleVolumeChange"
            />
            <span class="text-xs text-foreground/50 w-10 text-right shrink-0">
              {{ Math.round(volume * 100) }}%
            </span>
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

        <div
          class="mt-4 flex flex-wrap items-center gap-6 border-t border-border pt-4"
        >
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm">自动播放：</span>
            <Switch v-model:checked="config.autoplay" />
          </div>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="text-sm">离屏继续播放：</span>
            <Switch v-model:checked="keepPlayingOffscreen" />
          </div>
          <span class="text-xs text-foreground/50">开启后，滚动出屏幕将不会被底层自动暂停。</span>
        </div>
      </Card>

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
          :url="currentUrl"
          :width="320"
          :height="180"
        />
      </Card>
    </template>
  </Page>
</template>
