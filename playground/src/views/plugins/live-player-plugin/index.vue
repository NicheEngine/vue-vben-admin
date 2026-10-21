<script lang="ts" setup>
import type { LivePlayerProps } from '@vben/live-player';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Hls, LiveType, Mpegts, useLivePlayer } from '@vben/live-player';

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
  createLiveAdapter,
  NetworkChart,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';
import MultiScreenCompare from './components/multi-screen-compare.vue';

defineOptions({ name: 'LivePlayerPluginExample' });

// ============================================================
// 一、依赖库加载检测 (hls.js / mpegts.js)
// ============================================================
const hlsReady = ref(false);
const mpegtsReady = ref(false);

const librariesReady = computed(() => hlsReady.value && mpegtsReady.value);

async function checkLibraries() {
  // 只要库被正确导出，检查其核心 API 是否存在即可
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
  onError: (err) => {
    console.warn('[live] player error:', err.message);
  },
});

const player = createLiveAdapter(api);

// ============================================================
// 三、响应式状态
// ============================================================
const isPlaying = api.useSelector((s) => s.isPlaying);
const volume = api.useSelector((s) => s.volume);
const muted = api.useSelector((s) => s.muted);

// 真正断开流的状态控制
const isPlayerDestroyed = ref(false);
const playerKey = ref(0);

const effectiveType = computed(() => {
  if (config.type) return config.type;
  if (!currentUrl.value) return '-';
  return currentUrl.value.includes('.m3u8') ? 'hls' : 'mpegts';
});

// ============================================================
// 四、画面尺寸（完整恢复 fixed / ratio 功能）
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
  if (!player.videoWidth.value || !player.videoHeight.value) return '-';
  return (player.videoWidth.value / player.videoHeight.value).toFixed(2);
});

const scaleMode = ref<0 | 1 | 2>(1);
const SCALE_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '拉伸填满',
  1: '等比留黑边',
  2: '等比裁切',
};

// ============================================================
// 五、交互
// ============================================================
function applyUrl(u?: string) {
  const value = (u ?? inputUrl.value).trim();
  if (!value) return;
  currentUrl.value = value;
  lastUrl.value = value;
  isPlayerDestroyed.value = false;
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
  isPlayerDestroyed.value = false;
  playerKey.value++;
  api.pause();
  api.setUrl('');
}

function handleToggle() {
  if (isPlayerDestroyed.value) {
    if (lastUrl.value) {
      currentUrl.value = lastUrl.value;
      isPlayerDestroyed.value = false;
      playerKey.value++;
      setTimeout(() => api.play(), 100);
    }
    return;
  }

  const v = document.querySelector('video');
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
  isPlayerDestroyed.value = false;
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

function handleMuteChange(checked: boolean) {
  api.setMuted(checked);
}

function handleVolumeChange(value: number) {
  api.setVolume(value);

  const v = document.querySelector('video');
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

function handleFullscreen() {
  const videoContainer = document.querySelector('video')?.parentElement;
  if (!videoContainer) return;

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(console.warn);
  } else {
    videoContainer.requestFullscreen().catch(console.warn);
  }
}

function handleClear() {
  isPlayerDestroyed.value = true;
  api.pause();
  api.updatePlaying(false);
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  scaleMode.value = mode;
  player.setScaleMode?.(mode);
}

// ============================================================
// 六、多屏对比开关
// ============================================================
const showMultiScreen = ref(false);

// ============================================================
// 七、生命周期
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

    <!-- ===== 依赖缺失时的占位页面（后续自己编辑） ===== -->
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

    <!-- ===== 库就绪时展示原有完整页面（无任何删减） ===== -->
    <template v-else>
      <!-- ===== 播放地址 ===== -->
      <Card class="mb-4" title="播放地址">
        <ProtocolDetect
          v-model="inputUrl"
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

      <!-- ===== 播放器 ===== -->
      <Card class="mb-4" title="播放器">
        <template #extra>
          <span v-if="player.isLoading.value" class="text-xs text-orange-500">加载中...</span>
          <span v-else-if="player.error.value" class="text-xs text-red-500">错误：{{ player.error.value }}</span>
          <span
            v-else-if="player.isPlaying.value && !isPlayerDestroyed"
            class="text-xs text-green-500"
            >播放中</span>
        </template>

        <div class="flex justify-center">
          <div
            class="overflow-hidden rounded-xl border border-border bg-black relative"
            :style="containerStyle"
          >
            <Player
              v-if="!isPlayerDestroyed"
              :key="playerKey"
              :url="currentUrl"
              :autoplay="config.autoplay"
              :controls="config.controls"
              :muted="muted"
              :type="config.type"
              class="h-full w-full"
            >
              <template #loading>
<span class="text-white">加载中...</span>
</template>
              <template #error="{ error }">
<span>播放失败：{{ error }}</span>
</template>
            </Player>

            <!-- 清除后的占位层 -->
            <div
              v-else
              class="absolute inset-0 bg-black flex items-center justify-center z-10"
            >
              <span class="text-foreground/40 text-sm">画面已清除 (流已断开)</span>
            </div>
          </div>
        </div>
      </Card>

      <!-- ===== 播放状态面板 ===== -->
      <PlayStatusPanel class="mb-4" :player="player" />

      <!-- ===== 画面尺寸 ===== -->
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
          自适应模式：容器占满父级，高度固定 480px。
        </div>
      </Card>

      <!-- ===== 播放控制 ===== -->
      <Card class="mb-4" title="播放控制">
        <div class="flex flex-wrap items-center gap-3">
          <Button @click="handleToggle">
{{
            isPlaying && !isPlayerDestroyed ? '暂停' : '播放'
          }}
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

        <!-- 合并进来的播放参数 -->
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
        </div>
      </Card>

      <!-- ===== 网络质量实时曲线 ===== -->
      <Card class="mb-4" title="网络质量实时曲线">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <NetworkChart
            :value="(player.stats.value?.vbps || 0) / 1024"
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
          :url="currentUrl"
          :width="320"
          :height="180"
          :type="config.type"
        />
      </Card>
    </template>
  </Page>
</template>
