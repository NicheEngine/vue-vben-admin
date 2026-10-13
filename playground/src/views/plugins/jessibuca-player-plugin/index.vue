<script lang="ts" setup>
import type { JessibucaConfig } from '@vben/jessibuca-player';

import {
  computed,
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
  Switch,
  Tag,
} from 'antdv-next';

import MultiScreenCompare from './components/multi-screen-compare.vue';
import NetworkChart from './components/network-chart.vue';
import PlayStatusPanel from './components/play-status-panel.vue';
import ProtocolDetect from './components/protocol-detect.vue';
import RecordPanel from './components/record-panel.vue';
import ScreenshotPreview from './components/screenshot-preview.vue';

defineOptions({ name: 'JessibucaPluginExample' });

// ============================================================
// 一、库加载校验
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
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  let count = 0;
  checkTimer = setInterval(async () => {
    count += 1;
    const stop = () => {
      if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
      }
    };
    if (checkJessibuca()) {
      stop();
      await runFullCheck();
    } else if (count > 15) {
      stop();
    }
  }, 200);
}

async function recheckJessibuca() {
  decoderJsOk.value = null;
  decoderWasmOk.value = null;
  await runFullCheck();
  if (!jessibucaReady.value) startPolling();
}

const jessibucaViteConfig = `application: {
  // 开启 插件依赖注入（包括拷贝资源文件、index.html 注入库文件引用）
  depend: true,
  dependOptions: {
    // 打包构建时 开启插件依赖注入
    build: true,
    // 开发调试时 开启插件依赖注入
    serve: true,
    // 依赖选项
    depends: {
      // jessibuca 相关选项配置
      jessibuca: {
        // source 从何处拷贝库文件
        source: '../libraries/jessibuca',
      },
    },
  },
},`;

// ============================================================
// 二、播放器配置
// ============================================================

const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);

/** 实时码率 kBps（提前声明，供 onStats 闭包使用） */
const currentKbps = ref(0);

const config = reactive<JessibucaConfig>({
  autoPlay: true,
  isMute: true,
  debug: true,
  decoder: '/jessibuca/decoder.js',
  timeout: 10,
  videoBuffer: 0.5,
  isResize: true,
  scaleMode: 1,
  supportDblclickFullscreen: true,
  useWebFullScreen: false,
  enableRecording: false,
  recordType: 'webm',
  loadingTimeoutReplay: false,
  heartTimeoutReplay: false,
  loadingTimeoutReplayTimes: 0,
  heartTimeoutReplayTimes: 0,
});

// 只传回调，url/config 交给组件 props 单向管理
const [Player, api] = useJessibucaPlayer({
  url: currentUrl.value,
  config: { ...config },
  onStats: (stats) => {
    currentKbps.value = (stats.vbps || 0) / 8 / 1024;
  },
});

// ============================================================
// 三、状态
// ============================================================

const scaleMode = api.useSelector((s) => s.config.scaleMode);
const isPlaying = api.useSelector((s) => s.isPlaying);
const isLoading = api.useSelector((s) => s.isLoading);
const errorMsg = api.useSelector((s) => s.error);
const videoWidth = api.useSelector((s) => s.videoWidth);
const videoHeight = api.useSelector((s) => s.videoHeight);
const networkDelay = api.useSelector((s) => s.networkDelay);
const isMuted = api.useSelector((s) => s.isMuted);
const isRecording = api.useSelector((s) => s.isRecording);
const volume = api.useSelector((s) => s.volume);

const videoRatio = computed(() => {
  if (!videoWidth.value || !videoHeight.value) return '-';
  return (videoWidth.value / videoHeight.value).toFixed(2);
});

const scaleModeLabel = computed(() => {
  switch (scaleMode.value) {
    case 0: {
      return '拉伸填满';
    }
    case 1: {
      return '等比留黑边';
    }
    case 2: {
      return '等比裁切';
    }
    default: {
      return '未知';
    }
  }
});

const decoderJsStatus = computed(() =>
  decoderJsOk.value === false ? '缺失' : '正常',
);
const decoderWasmStatus = computed(() =>
  decoderWasmOk.value === false ? '缺失' : '正常',
);

// ============================================================
// 四、画面尺寸
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
    return {
      width: `${fixedWidth.value}px`,
      height: `${fixedHeight.value}px`,
    };
  }
  if (sizeMode.value === 'ratio') {
    const opt =
      ratioOptions.find((o) => o.value === ratio.value) ?? DEFAULT_RATIO;
    const height = Math.round((ratioBaseWidth.value * opt.h) / opt.w);
    return {
      width: `${ratioBaseWidth.value}px`,
      height: `${height}px`,
    };
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

/** 多屏对比开关（默认关闭，避免 3 路并发） */
const showMultiScreen = ref(false);

// ============================================================
// 五、交互
// ============================================================

function applyUrl(u?: string) {
  const value = (u ?? inputUrl.value).trim();
  if (!value) return;

  // 只改 props.url，组件 watch 会同步到 api 并（autoPlay 时）播放
  currentUrl.value = value;

  const history = urlHistory.value.filter((h) => h !== value);
  history.unshift(value);
  urlHistory.value = history.slice(0, 10);
}

function resetUrl() {
  inputUrl.value = DEFAULT_URL;
  applyUrl();
}

function handleToggle() {
  api.toggle();
}

function handleReload() {
  // currentUrl 未变，watch 不触发，显式重播
  void api.play();
}

function handleMuteChange(checked: boolean) {
  config.isMute = checked; // 同步 reactive config，避免下次 watch 回退
  checked ? api.mute() : api.cancelMute();
}

function handleVolumeChange(value: number) {
  config.volume = value;
  api.setVolume(value);
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
  config.scaleMode = mode;
  api.setScaleMode(mode);
}

/**
 * 截图。
 * 注意：只传 filename，让 Jessibuca 用默认格式；
 * 传 undefined 会触发 `r.split is not a function`。
 */
function handleScreenshot(): string {
  const result = api.screenshot(`jessibuca-${Date.now()}`, 'png', 1, 'base64');
  return typeof result === 'string' ? result : '';
}

function handleFullscreen() {
  api.resize();
}

function handleClear() {
  api.clearView();
}

// 容器尺寸变化时通知 Jessibuca 重新布局
watch([sizeMode, fixedWidth, fixedHeight, ratio, ratioBaseWidth], () => {
  if (!jessibucaReady.value) return;
  setTimeout(() => api.resize(), 0);
});

onMounted(async () => {
  await runFullCheck();
  if (!jessibucaReady.value) startPolling();
  // onStats 已通过 useJessibucaPlayer options 注册，无需再 setCallbacks
});

onBeforeUnmount(() => {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  void api.destroy();
});
</script>

<template>
  <Page title="Jessibuca 播放器">
    <template #description>
      <div class="mt-2 text-foreground/80">
        Jessibuca 是一个纯 JavaScript 的 FLV / HLS 流媒体播放器，支持
        WebSocket-FLV、HTTP-FLV、HLS、WebRTC 等协议。
      </div>
    </template>

    <Alert
      v-if="!jessibucaReady"
      type="error"
      show-icon
      class="mb-4"
      message="未检测到 Jessibuca 库"
      description="请确认 vite.config.ts 中已配置 jessibuca 依赖，并且 public/jessibuca/jessibuca.js 已加载。"
    >
      <template #action>
        <Button size="small" @click="recheckJessibuca">重新检测</Button>
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
      :description="`decoder.js: ${decoderJsStatus}，decoder.wasm: ${decoderWasmStatus}。请检查 public/jessibuca/ 目录。`"
    />

    <Card v-if="!jessibucaReady" class="mb-4" title="vite.config.ts 配置参考">
      <div class="text-sm text-foreground/80">
        在
        <code class="rounded bg-muted px-1 py-0.5 text-xs">
          vite.config.ts
        </code>
        的
        <code class="rounded bg-muted px-1 py-0.5 text-xs">
          application.dependOptions.depends
        </code>
        中加入下列配置：
      </div>
      <pre
        class="mt-3 overflow-auto rounded-xl border border-border bg-muted p-4 text-xs"
      ><code>{{ jessibucaViteConfig }}</code></pre>
      <div class="mt-3 text-xs text-foreground/50">
        把 <code>../libraries/jessibuca</code> 替换为你项目里 jessibuca
        文件的实际目录。
      </div>
    </Card>

    <template v-if="jessibucaReady">
      <!-- ===== 播放地址 + 协议识别 ===== -->
      <Card class="mb-4" title="播放地址">
        <ProtocolDetect
          v-model="inputUrl"
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

      <!-- ===== 播放器 ===== -->
      <Card class="mb-4" title="播放器">
        <div class="flex justify-center">
          <div
            class="overflow-hidden rounded-xl border border-border bg-black"
            :style="containerStyle"
          >
            <Player
              :api="api"
              :url="currentUrl"
              :config="config"
              class="h-full w-full"
            />
          </div>
        </div>
      </Card>

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
          <InputNumber
            v-model:value="fixedWidth"
            :min="160"
            :max="3840"
            addon-after="px"
          />
          <span class="ml-2 text-sm">高：</span>
          <InputNumber
            v-model:value="fixedHeight"
            :min="90"
            :max="2160"
            addon-after="px"
          />
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
          <InputNumber
            v-model:value="ratioBaseWidth"
            :min="160"
            :max="3840"
            addon-after="px"
          />
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
            {{ isPlaying ? '暂停' : '播放' }}
          </Button>
          <Button @click="handleReload">重新加载</Button>
          <Button @click="handleFullscreen">适配容器</Button>
          <Button @click="handleClear">清除画面</Button>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <span class="text-sm">静音：</span>
          <Switch :checked="isMuted" @change="handleMuteChange" />
          <span class="ml-4 text-sm">音量：</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="volume"
            class="w-40"
            @input="
              (e) =>
                handleVolumeChange(Number((e.target as HTMLInputElement).value))
            "
          />
          <span class="text-xs text-foreground/50">
            {{ Math.round(volume * 100) }}%
          </span>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <span class="text-sm">缩放模式：</span>
          <Button
            v-for="mode in [0, 1, 2]"
            :key="mode"
            :type="scaleMode === mode ? 'primary' : 'default'"
            size="small"
            @click="handleScaleModeChange(mode as 0 | 1 | 2)"
          >
            {{ mode === 0 ? '拉伸' : mode === 1 ? '等比留黑边' : '等比裁切' }}
          </Button>
          <Tag color="blue">{{ scaleModeLabel }}</Tag>
        </div>
      </Card>

      <!-- ===== 网络质量实时曲线 ===== -->
      <Card class="mb-4" title="网络质量实时曲线">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <NetworkChart
            :value="currentKbps"
            label="实时码率"
            unit="kB/s"
            color="#22c55e"
          />
          <NetworkChart
            :value="networkDelay"
            label="网络延迟 (buf)"
            unit="ms"
            color="#f59e0b"
          />
        </div>
      </Card>

      <!-- ===== 录制面板 ===== -->
      <RecordPanel
        class="mb-4"
        :is-recording="isRecording"
        :start-record="api.startRecord"
        :stop-record-and-save="api.stopRecordAndSave"
      />

      <!-- ===== 截图预览 ===== -->
      <ScreenshotPreview class="mb-4" :capture="handleScreenshot" />

      <!-- ===== 多屏对比 ===== -->
      <Card class="mb-4" title="多屏对比">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <span class="text-sm">启用：</span>
          <Switch v-model:checked="showMultiScreen" />
          <span class="text-xs text-foreground/50">
            开启后会创建 3 个独立播放器实例（同一路流、三种缩放模式），对
            CPU/带宽有额外压力。
          </span>
        </div>
        <MultiScreenCompare
          v-if="showMultiScreen"
          :url="currentUrl"
          :width="320"
          :height="180"
        />
      </Card>

      <!-- ===== 播放状态 ===== -->
      <PlayStatusPanel
        :is-playing="isPlaying"
        :is-loading="isLoading"
        :is-recording="isRecording"
        :is-muted="isMuted"
        :video-width="videoWidth"
        :video-height="videoHeight"
        :network-delay="networkDelay"
        :error-msg="errorMsg"
        :scale-mode-label="scaleModeLabel"
      />
    </template>
  </Page>
</template>
