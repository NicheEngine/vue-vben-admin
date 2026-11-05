<script lang="ts" setup>
import type { AutoPlayerExpose, PlayerEngine } from '@vben/auto-player';
import type { OssrsObjectFit } from '@vben/ossrs-player';

import type { IPlayerApi } from '../player-shared';

import { computed, ref, watch } from 'vue';

import { AutoPlayer } from '@vben/auto-player';
import { Page } from '@vben/common-ui';

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
  NetworkChart,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';

defineOptions({ name: 'AutoPlayerPluginExample' });

// ============================================================
// 一、基础实例与代理映射
// ============================================================
const autoPlayerRef = ref<AutoPlayerExpose | null>(null);

// 强大的傻瓜式 Adapter，直接将 proxyApi 挂载给 IPlayerApi 使用
const player = computed<IPlayerApi | null>(() => {
  const proxy = autoPlayerRef.value?.api;
  if (!proxy) return null;

  return {
    isPlaying: computed(() => proxy.state.isPlaying),
    isLoading: computed(() => proxy.state.isLoading),
    isReady: computed(() => proxy.state.isReady),
    error: computed(() => proxy.state.error),
    volume: computed(() => proxy.state.volume),
    isMuted: computed(() => proxy.state.isMuted),
    videoWidth: computed(() => proxy.state.videoWidth),
    videoHeight: computed(() => proxy.state.videoHeight),
    currentTime: computed(() => proxy.state.currentTime),
    networkDelay: computed(() => proxy.state.networkDelay),
    stats: computed(() => proxy.state.stats || { vbps: 0, buf: 0 }),
    isRecording: computed(() => proxy.state.isRecording),
    recordingDuration: computed(() => proxy.state.recordingDuration),
    scaleMode: ref(1),

    capabilities: {
      screenshot: true,
      record: true,
      scaleMode: true,
      stats: true,
      seek: false,
      fullscreen: true,
    },

    play: proxy.play,
    pause: proxy.pause,
    toggle: proxy.toggle,
    setVolume: proxy.setVolume,
    setMuted: proxy.setMuted,
    setUrl: proxy.setUrl,
    setScaleMode: proxy.setScaleMode,
    screenshot: proxy.screenshot,
    startRecord: proxy.startRecord,
    stopRecordAndSave: proxy.stopRecordAndSave,
    requestFullscreen: proxy.requestFullscreen,
    exitFullscreen: proxy.exitFullscreen,
    destroy: proxy.destroy,
  };
});

// ============================================================
// 二、播放地址与配置状态
// ============================================================
const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);

const config = ref({
  autoplay: true,
  muted: true,
});

const forcedEngine = ref<PlayerEngine>('none');
const engineOptions = [
  { label: '自动识别', value: 'none' },
  { label: '强制 OSSRS (WebRTC)', value: 'ossrs' },
  { label: '强制 LivePlayer (HLS/FLV)', value: 'live' },
  { label: '强制 Jessibuca (FLV)', value: 'jessibuca' },
  { label: '强制 EasyPlayer (FLV)', value: 'easy' },
];

const activeEngineLabel = computed(() => {
  const map: Record<string, string> = {
    ossrs: 'OSSRS (WebRTC)',
    live: 'LivePlayer',
    jessibuca: 'Jessibuca',
    easy: 'EasyPlayer',
    none: '无可用引擎',
  };
  return map[autoPlayerRef.value?.api.getActiveEngine() || 'none'];
});

// ============================================================
// 三、画面尺寸控制（自适应 / 固定 / 比例）
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
  if (!player.value?.videoWidth.value || !player.value?.videoHeight.value)
    return '-';
  return (
    player.value.videoWidth.value / player.value.videoHeight.value
  ).toFixed(2);
});

// ============================================================
// 四、缩放模式与高级控制
// ============================================================
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

// ============================================================
// 五、交互方法
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

function handleMuteChange(checked: boolean) {
  config.value.muted = checked;
  player.value?.setMuted(checked);
}

function handleVolumeChange(value: number) {
  player.value?.setVolume(value);
  if (value === 0 && !config.value.muted) {
    config.value.muted = true;
    player.value?.setMuted(true);
  } else if (value > 0 && config.value.muted) {
    config.value.muted = false;
    player.value?.setMuted(false);
  }
}

function handleFullscreen() {
  player.value?.requestFullscreen?.();
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  scaleMode.value = mode;
  player.value?.setScaleMode?.(mode);
}

function handleScreenshot(): string {
  const result = player.value?.screenshot?.();
  return typeof result === 'string' ? result : '';
}

// 当强制切换引擎时，必须让播放器重新加载 URL
watch(forcedEngine, () => {
  if (currentUrl.value) {
    // 利用 setTimeout 确保底层 engine 已经切换完毕
    setTimeout(() => player.value?.setUrl(currentUrl.value), 100);
  }
});
</script>

<template>
  <Page title="AutoPlayer 终极联合播放器">
    <template #description>
      <div class="mt-2 text-foreground/80">
        AutoPlayer 是一个智能调度容器，自动探测流媒体协议与底层资源，在
        WebRTC、HLS 及多种 FLV 引擎间无缝切换，为您提供最优的播放体验。
      </div>
    </template>

    <Alert class="mb-4" type="info" show-icon message="环境说明与智能调度规则">
      <template #description>
        <div class="text-xs leading-relaxed mt-2 space-y-2 text-foreground/80">
          <p>
            <b>🎯 智能调度规则：</b><br />
            系统会自动嗅探当前浏览器的运行环境，并根据流媒体协议为您分配最优的播放器内核：
          </p>
          <ul class="list-disc pl-4 space-y-1">
            <li>
              <b>WebRTC / WHEP</b> 协议：自动分配 <b>OSSRS</b>（原生极低延迟）。
            </li>
            <li>
              <b>HLS (.m3u8)</b> 协议：自动分配 <b>LivePlayer</b>（hls.js
              兼容性好）。
            </li>
            <li>
              <b>FLV (.flv)</b> 协议：优先使用 <b>Jessibuca</b>（WASM 软解，支持
              H.265）； 若缺少 WASM 资源，则降级使用
              <b>EasyPlayer</b>；再缺失则兜底使用 <b>LivePlayer</b>。
            </li>
          </ul>
          <p class="pt-2">
            <b>💡 使用说明：</b><br />
            您可以直接在下方输入框粘贴流地址，也可以使用右侧的<b>“强制切换引擎”</b>进行手动接管测试。
            此组件已自动处理了不同内核间的内存释放与切换逻辑。
          </p>
        </div>
      </template>
    </Alert>

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
        <Tag color="blue" class="text-sm px-3 py-1">
当前生效：{{ activeEngineLabel }}
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

    <!-- 播放器主区域 -->
    <Card class="mb-4" title="播放器">
      <template #extra>
        <span v-if="player?.isLoading.value" class="text-xs text-orange-500">加载中...</span>
        <span v-else-if="player?.error.value" class="text-xs text-red-500">错误：{{ player.error.value }}</span>
        <span v-else-if="player?.isPlaying.value" class="text-xs text-green-500">播放中</span>
      </template>

      <div class="flex justify-center w-full">
        <div
          class="overflow-hidden rounded-xl border border-border bg-black relative"
          :style="containerStyle"
        >
          <AutoPlayer
            ref="autoPlayerRef"
            :url="currentUrl"
            :prefer-engine="forcedEngine"
            :autoplay="config.autoplay"
            :muted="config.muted"
            :object-fit="objectFit"
            class="w-full h-full absolute inset-0"
          />
          <div
            v-if="!currentUrl"
            class="absolute inset-0 flex items-center justify-center text-foreground/40 text-sm"
          >
            请输入流媒体地址
          </div>
        </div>
      </div>
    </Card>

    <!-- 状态面板 -->
    <template v-if="player">
      <PlayStatusPanel class="mb-4" :player="player" />
    </template>

    <!-- 画面尺寸控制 (与之前各单播放器一致) -->
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
      </div>
    </Card>

    <!-- 播放控制 -->
    <Card class="mb-4" title="播放控制">
      <div class="flex flex-wrap items-center gap-3">
        <Button @click="player?.toggle()">
          {{ player?.isPlaying.value ? '暂停' : '播放' }}
        </Button>
        <Button @click="handleFullscreen">全屏播放</Button>
        <Button @click="resetUrl">清除画面</Button>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-6">
        <div class="flex items-center gap-2 whitespace-nowrap">
          <span class="text-sm">静音：</span>
          <Switch :checked="player?.isMuted.value" @change="handleMuteChange" />
        </div>
        <div class="flex items-center gap-2 whitespace-nowrap">
          <span class="text-sm shrink-0">音量：</span>
          <Slider
            class="w-40 shrink-0"
            :min="0"
            :max="1"
            :step="0.01"
            :value="player?.volume.value"
            @change="handleVolumeChange"
          />
          <span class="text-xs text-foreground/50 w-10 text-right shrink-0">
            {{ Math.round((player?.volume.value || 0) * 100) }}%
          </span>
        </div>
      </div>

      <div
        class="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4"
      >
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
          <Switch v-model:checked="config.autoplay" />
        </div>
      </div>
    </Card>

    <!-- 网络统计 -->
    <Card class="mb-4" title="网络质量实时曲线">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NetworkChart
          :value="(player?.stats.value.vbps || 0) / 8 / 1024"
          label="实时码率"
          unit="kB/s"
          color="#22c55e"
        />
        <NetworkChart
          :value="player?.networkDelay.value || 0"
          label="网络延迟"
          unit="ms"
          color="#f59e0b"
        />
      </div>
    </Card>

    <!-- 录制与截图 -->
    <template v-if="player?.capabilities.record">
      <RecordPanel
        class="mb-4"
        :is-recording="player.isRecording.value"
        :recording-duration="player.recordingDuration.value"
        :start-record="player.startRecord!"
        :stop-record-and-save="player.stopRecordAndSave!"
        :can-record="player.isPlaying.value"
      />
    </template>

    <template v-if="player?.capabilities.screenshot && player.screenshot">
      <ScreenshotPreview class="mb-4" :capture="handleScreenshot" />
    </template>

    <!-- 多屏对比 (仅限支持的画面) -->
    <Card class="mb-4" title="多屏对比">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <span class="text-sm">启用：</span>
        <Switch
          :checked="showMultiScreen"
          @change="(val) => (showMultiScreen = val)"
        />
        <span class="text-xs text-foreground/50">
          开启后会创建 3 个独立实例（同一路流、三种缩放模式）。
        </span>
      </div>
      <div v-if="showMultiScreen" class="grid grid-cols-3 gap-4">
        <!-- 因为 AutoPlayer 会自己路由，所以直接开三个 AutoPlayer 即可 -->
        <div v-for="mode in [0, 1, 2]" :key="mode" class="flex flex-col gap-2">
          <div class="text-sm text-foreground/70">
            {{ SCALE_MODE_LABELS[mode as 0 | 1 | 2] }}
          </div>
          <div
            class="relative overflow-hidden rounded border border-border bg-black h-[200px]"
          >
            <AutoPlayer
              :url="currentUrl"
              :prefer-engine="forcedEngine"
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
