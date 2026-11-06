<script lang="ts" setup>
import type { OssrsObjectFit, OssrsPlayerProps } from '@vben/ossrs-player';

import { computed, onBeforeUnmount, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useOssrsPlayer } from '@vben/ossrs-player';

import { Card, Collapse, CollapsePanel, Select, Switch, Tag } from 'antdv-next';

import {
  createOssrsAdapter,
  detectOssrsProtocol,
  MultiScreenCompare,
  NetworkChart,
  PlayerControlCard,
  PlayerSizeCard,
  PlayStatusPanel,
  ProtocolDetect,
  RecordPanel,
  ScreenshotPreview,
} from '../player-shared';

defineOptions({ name: 'OssrsPluginExample' });

const DEFAULT_URL = '';
const inputUrl = ref(DEFAULT_URL);
const currentUrl = ref(DEFAULT_URL);
const urlHistory = ref<string[]>([]);
const isCleared = ref(false);

const config = reactive<OssrsPlayerProps>({
  autoplay: true,
  muted: true,
  protocol: 'rtc',
});

const [Player, api] = useOssrsPlayer({
  onError: (err: any) => {
    console.warn('[ossrs] player error:', err);
  },
});

const player = createOssrsAdapter(api);

const effectiveType = computed(() => {
  if (!currentUrl.value) return '-';
  const proto = detectOssrsProtocol(currentUrl.value);
  const map: Record<string, string> = {
    whep: 'WHEP',
    rtc: 'SRS RTC',
    flv: 'FLV (HTTP)',
    'ws-flv': 'WS-FLV (WebSocket)',
    'wss-flv': 'WSS-FLV (WebSocket 加密)',
    hls: 'HLS (M3U8)',
    unknown: '未知',
  };
  return map[proto] || '未知';
});

const SCALE_MODE_FIT: Record<0 | 1 | 2, OssrsObjectFit> = {
  0: 'fill',
  1: 'contain',
  2: 'cover',
};

// 当前使用的 object-fit，绑定给 Player
const objectFit = computed(() => SCALE_MODE_FIT[player.scaleMode.value]);

const showMultiScreen = ref(false);

const multiPlayers = computed(() => {
  if (!showMultiScreen.value || !currentUrl.value) return [];

  const modes = [
    { mode: 0 as const, label: '拉伸填满', fit: 'fill' as OssrsObjectFit },
    { mode: 1 as const, label: '等比留黑边', fit: 'contain' as OssrsObjectFit },
    { mode: 2 as const, label: '等比裁切', fit: 'cover' as OssrsObjectFit },
  ] as const;

  return modes.map(({ mode, label, fit }) => {
    const [Player, api] = useOssrsPlayer({
      initialUrl: currentUrl.value,
      initialState: {
        autoplay: true,
        muted: true,
        url: currentUrl.value,
      },
    });

    return {
      component: Player,
      props: {
        api,
        url: currentUrl.value,
        protocol: config.protocol || 'rtc',
        autoplay: true,
        muted: true,
        'object-fit': fit,
      },
      onDestroy: () => api.destroy(),
      mode,
      label,
    };
  });
});

function applyUrl(u?: string) {
  const value = (u ?? inputUrl.value).trim();
  if (!value) return;

  const lower = value.toLowerCase();

  // Oryx 底层的 SrsRtc 库实际上只认 rtc 和 whep
  let autoProtocol: 'rtc' | 'whep' = 'rtc';
  if (lower.includes('/whep/') || lower.includes('/whip-play/')) {
    autoProtocol = 'whep';
  }

  // UI 状态同步
  const detectedProtocol = detectOssrsProtocol(value);
  if (
    detectedProtocol !== 'unknown' &&
    config.protocol !== (detectedProtocol as any)
  ) {
    config.protocol = detectedProtocol === 'whep' ? 'whep' : 'rtc';
  }

  isCleared.value = false;
  currentUrl.value = value;

  const history = urlHistory.value.filter((h) => h !== value);
  history.unshift(value);
  urlHistory.value = history.slice(0, 10);

  api.play(value, autoProtocol);
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
  if (document.fullscreenElement) {
    void player.exitFullscreen?.();
  } else {
    void player.requestFullscreen?.();
  }
}

function handleClear() {
  isCleared.value = true;
  api.destroyPlayer();
}

function handleScaleModeChange(mode: 0 | 1 | 2) {
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
        OSSRS 基于 Oryx 强大的 WebRTC 网关，提供极低延迟的视频播放能力。<br />
        <span class="text-green-500 font-bold">支持协议：WebRTC, WHEP, HTTP-FLV, WS-FLV, HLS (M3U8)</span>。
      </div>
    </template>

    <Collapse class="mb-4">
      <CollapsePanel
        key="1"
        header="💡 OSSRS 全协议网关说明（专为 Oryx / SRS 定制）"
      >
        <div class="text-xs leading-relaxed text-foreground/80 space-y-3">
          <p>
            <b>OSSRS 播放器具备极强的兼容性。</b>Oryx
            具备强大的<b>全协议统一网关</b>，只要您的流媒体服务是 Oryx 或
            SRS，无论您输入以下哪种地址，底层都会自动将其转化为
            <code>/rtc/v1/play/</code> 的 WebRTC
            流，为您提供极低延迟的播放体验：
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="bg-black/20 p-2 rounded border border-border">
              <div class="font-bold text-blue-400 mb-1">WebRTC 原生协议</div>
              <code>webrtc://[IP]:[PORT]/live/[流名称]</code><br />
              <code>rtc://[IP]:[PORT]/live/[流名称]</code>
            </div>
            <div class="bg-black/20 p-2 rounded border border-border">
              <div class="font-bold text-green-400 mb-1">WHEP 标准协议</div>
              <code>http://[IP]:[PORT]/whep/...</code>
            </div>
            <div class="bg-black/20 p-2 rounded border border-border">
              <div class="font-bold text-orange-400 mb-1">
                FLV 系列 (极速转 WebRTC)
              </div>
              <code>http://[IP]:[PORT]/live/[流名称].flv</code><br />
              <code>ws://[IP]:[PORT]/live/[流名称].flv</code><br />
              <code>wss://[IP]:[PORT]/live/[流名称].flv</code>
            </div>
            <div class="bg-black/20 p-2 rounded border border-border">
              <div class="font-bold text-purple-400 mb-1">HLS (M3U8)</div>
              <code>http://[IP]:[PORT]/live/[流名称].m3u8</code>
            </div>
          </div>

          <div
            class="rounded-md bg-red-500/10 p-2 text-red-500 border border-red-500/20"
          >
            <b>⚠️ 安全与兼容性提示：</b><br />
            1. 如果使用 localhost 或 127.0.0.1，请确保浏览器不受 WebRTC
            安全上下文限制，建议用局域网 IP 或 HTTPS 环境测试。<br />
            2. 如果您测试的是<b>非 SRS/Oryx</b> 的普通流媒体服务器，请移步
            <b>AutoPlayer</b> 或对应的
            <b>LivePlayer / Jessibuca / EasyPlayer</b>
            插件进行测试，因为它们才支持标准的通用拉流协议。
          </div>
        </div>
      </CollapsePanel>
    </Collapse>

    <Card class="mb-4" title="播放地址">
      <ProtocolDetect
        v-model="inputUrl"
        placeholder="webrtc://... rtc://... 或 http://.../whep/"
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
    >
      <Player
        :api="api"
        :url="currentUrl"
        :protocol="config.protocol"
        :muted="config.muted"
        :autoplay="config.autoplay"
        :object-fit="objectFit"
        class="h-full w-full absolute inset-0"
      />
      <div
        v-if="isCleared"
        class="absolute inset-0 bg-black flex items-center justify-center z-10"
      >
        <span class="text-foreground/40 text-sm">画面已清除 (连接已断开)</span>
      </div>
    </PlayerSizeCard>

    <PlayStatusPanel class="mb-4" :player="player" />

    <!-- ✅ 替换：使用 PlayerControlCard -->
    <PlayerControlCard
      class="mb-4"
      :player="player"
      :is-cleared="isCleared"
      @toggle="handleToggle"
      @reload="handleReload"
      @fullscreen="handleFullscreen"
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
      </template>
    </PlayerControlCard>

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
        :players="multiPlayers"
        :height="300"
        :protocol="config.protocol"
      />
    </Card>
  </Page>
</template>
