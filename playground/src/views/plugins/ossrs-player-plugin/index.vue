<script lang="ts" setup>
import type { OssrsObjectFit, OssrsPlayerProps } from '@vben/ossrs-player';

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { useOssrsPlayer } from '@vben/ossrs-player';

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
  createOssrsAdapter,
  detectOssrsProtocol,
  NetworkChart,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';
import MultiScreenCompare from './components/multi-screen-compare.vue';

defineOptions({ name: 'OssrsPluginExample' });

const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);
const isCleared = ref(false);

const config = reactive<OssrsPlayerProps>({
  autoPlay: true,
  muted: true,
  protocol: 'rtc',
});

const [Player, api] = useOssrsPlayer({
  onError: (err: any) => {
    console.warn('[ossrs] player error:', err);
  },
});

const player = createOssrsAdapter(api, config.protocol);

const vbps = ref(0);
const delay = ref(0);

watch(
  () => player.stats.value,
  (newStats) => {
    if (newStats) vbps.value = newStats.vbps || 0;
  },
  { deep: true },
);

watch(
  () => player.networkDelay.value,
  (newDelay) => {
    delay.value = newDelay || 0;
  },
);

const isPlaying = api.useSelector((s: any) => s.isPlaying);
const volume = api.useSelector((s: any) => s.volume);
const muted = api.useSelector((s: any) => s.muted);

const effectiveType = computed(() => {
  if (!currentUrl.value) return '-';
  const proto = detectOssrsProtocol(currentUrl.value);
  if (proto === 'whep') return 'WHEP';
  if (proto === 'rtc') return 'SRS RTC';
  return '未知';
});

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
  if (sizeMode.value === 'fixed') {
    return { width: `${fixedWidth.value}px`, height: `${fixedHeight.value}px` };
  }
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    const height = Math.round((ratioBaseWidth.value * opt.h) / opt.w);
    return { width: `${ratioBaseWidth.value}px`, height: `${height}px` };
  }
  return { width: '100%', height: '480px' };
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
  return '-';
});

const videoRatio = computed(() => {
  if (!player.videoWidth.value || !player.videoHeight.value) return '-';
  return (player.videoWidth.value / player.videoHeight.value).toFixed(2);
});

const scaleMode = ref<0 | 1 | 2>(1);
const SCALE_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '拉伸填满',
  1: '等比留黑边',
  2: '等比裁切',
};

const SCALE_MODE_FIT: Record<0 | 1 | 2, OssrsObjectFit> = {
  0: 'fill',
  1: 'contain',
  2: 'cover',
};

const objectFit = computed(() => SCALE_MODE_FIT[scaleMode.value]);

const showMultiScreen = ref(false);

function applyUrl(u?: string) {
  const value = (u ?? inputUrl.value).trim();
  if (!value) return;

  const detectedProtocol = detectOssrsProtocol(value);
  if (detectedProtocol !== 'unknown' && config.protocol !== detectedProtocol) {
    config.protocol = detectedProtocol;
  }

  isCleared.value = false;
  currentUrl.value = value;

  const history = urlHistory.value.filter((h) => h !== value);
  history.unshift(value);
  urlHistory.value = history.slice(0, 10);

  api.play(value, config.protocol);
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
    if (currentUrl.value) api.play(currentUrl.value, config.protocol);
    return;
  }
  api.toggle();
}

function handleReload() {
  isCleared.value = false;
  if (currentUrl.value) api.play(currentUrl.value, config.protocol);
}

function handleMuteChange(checked: boolean) {
  config.muted = checked;
  api.setMuted(checked);
}

function handleVolumeChange(value: number) {
  api.setVolume(value);
  if (value === 0) {
    config.muted = true;
    api.setMuted(true);
  } else if (config.muted) {
    config.muted = false;
    api.setMuted(false);
  }
}

function handleFullscreen() {
  if (document.fullscreenElement) void player.exitFullscreen?.();
  else void player.requestFullscreen?.();
}

function handleClear() {
  isCleared.value = true;
  api.pause();
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  scaleMode.value = mode;
  player.setScaleMode?.(mode);
}

function handleScreenshot(): string {
  const result = player.screenshot?.();
  return typeof result === 'string' ? result : '';
}

onBeforeUnmount(() => {
  void player.destroy();
});
</script>

<template>
  <Page title="OSSRS 播放器 (WebRTC)">
    <template #description>
      <div class="mt-2 text-foreground/80">
        OSSRS 基于 WebRTC 协议，提供极低延迟的视频播放能力。支持 SRS RTC 与 WHEP
        协议。
        <span class="text-red-500 font-bold">注意：不支持 HTTP-FLV 和 HLS 播放</span>。
      </div>
    </template>

    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="如何获取 Oryx WebRTC 播放地址？"
    >
      <template #description>
        <div class="text-xs leading-relaxed mt-1">
          1. 在 Oryx 后台推流成功后，进入 <b>“流信息”</b> 页面。<br />
          2. 找到 <b>WebRTC</b> 播放地址，格式通常为：
          <code>webrtc://[IP]:[PORT]/live/[流名称]</code>
          或 <code>rtc://[IP]:[PORT]/live/[流名称]</code>。<br />
          3. 将地址填入上方输入框点击应用即可（若使用 WHEP 协议，地址格式为
          <code>http://.../whep/</code>）。<br />
          <span class="text-red-500 font-medium">
            ⚠️ 重要：如果使用 localhost 或 127.0.0.1，请确保浏览器不受 WebRTC
            安全上下文限制，建议用局域网 IP 或 HTTPS 环境测试。
          </span>
        </div>
      </template>
    </Alert>

    <Card class="mb-4" title="播放地址">
      <ProtocolDetect
        v-model="inputUrl"
        placeholder="webrtc://... rtc://... 或 http://.../whep/"
        @apply="applyUrl"
        @reset="resetUrl"
      />
      <div class="mt-2 text-xs text-foreground/50">
        当前地址：{{ currentUrl || '（空）' }} | 推断类型：
        <Tag color="blue">
          {{ effectiveType }}
        </Tag>
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
        <span v-if="player.isLoading.value" class="text-xs text-orange-500">连接中...</span>
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

      <div class="flex justify-center">
        <div
          class="overflow-hidden rounded-xl border border-border bg-black relative"
          :style="containerStyle"
        >
          <Player
            :api="api"
            :url="currentUrl"
            :protocol="config.protocol"
            :muted="muted"
            :autoplay="config.autoPlay"
            :object-fit="objectFit"
            class="h-full w-full"
          />
          <div
            v-if="isCleared"
            class="absolute inset-0 bg-black flex items-center justify-center z-10"
          >
            <span class="text-foreground/40 text-sm">画面已清除 (连接已断开)</span>
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
          <InputNumber v-model:value="ratioBaseWidth" :min="160" :max="3840" />
          <SpaceAddon>px</SpaceAddon>
        </SpaceCompact>
        <span class="text-xs text-foreground/50">高度按比例自动计算</span>
      </div>
      <div v-if="sizeMode === 'auto'" class="mt-2 text-xs text-foreground/50">
        自适应模式：容器占满父级，高度固定 480px。
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
          :type="scaleMode === mode ? 'primary' : 'default'"
          size="small"
          @click="handleScaleModeChange(mode as 0 | 1 | 2)"
        >
          {{ mode === 0 ? '拉伸' : mode === 1 ? '等比留黑边' : '等比裁切' }}
        </Button>
        <Tag color="blue">{{ SCALE_MODE_LABELS[scaleMode] }}</Tag>
      </div>

      <div
        class="mt-4 flex flex-wrap items-center gap-6 border-t border-border pt-4"
      >
        <div class="flex items-center gap-2 whitespace-nowrap">
          <span class="text-sm">自动播放：</span>
          <Switch v-model:checked="config.autoPlay" />
        </div>
        <div class="flex items-center gap-2 whitespace-nowrap">
          <span class="text-sm">协议：</span>
          <Select
            v-model:value="config.protocol"
            class="w-32"
            :options="[
              { label: 'SRS RTC', value: 'rtc' },
              { label: 'WHEP', value: 'whep' },
            ]"
          />
        </div>
      </div>
    </Card>

    <Card class="mb-4" title="网络质量实时曲线">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NetworkChart
          :value="vbps / 8 / 1024"
          label="实时码率"
          unit="kB/s"
          color="#22c55e"
        />
        <NetworkChart
          :value="delay"
          label="网络延迟 (Jitter Buffer)"
          unit="ms"
          color="#f59e0b"
        />
      </div>
    </Card>

    <!-- ===== 录制面板 ===== -->
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

    <!-- ===== 截图预览 ===== -->
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
        <span class="text-xs text-foreground/50">
          开启后会创建 3 个独立实例（同一路流、三种缩放模式）。WebRTC 多实例对
          CPU 有一定压力。
        </span>
      </div>
      <MultiScreenCompare
        v-if="showMultiScreen"
        :url="currentUrl"
        :height="300"
        :protocol="config.protocol"
      />
    </Card>
  </Page>
</template>
