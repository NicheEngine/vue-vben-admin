import type { Ref } from 'vue';

// ============================================================
// 能力声明
// ============================================================

/**
 * 播放器能力声明。
 *
 * 所有字段均为 `boolean`，`true` 表示该能力可用，
 * 消费者应据此决定是否渲染对应 UI（如录制按钮、缩放切换）。
 *
 * 扩展字段（`pip` / `keepPlayingOffscreen`）为可选，
 * 旧 adapter 未实现时视为 `undefined`（等同 false）。
 */
export interface PlayerCapabilities {
  /** 是否支持截图 */
  screenshot: boolean;
  /** 是否支持录制 */
  record: boolean;
  /** 是否支持缩放模式切换（fill / contain / cover） */
  scaleMode: boolean;
  /** 是否支持网络统计（stats 字段有真实数据） */
  stats: boolean;
  /** 是否支持 seek（直播流通常 false） */
  seek: boolean;
  /** 是否支持全屏（requestFullscreen / exitFullscreen） */
  fullscreen: boolean;
  /** 是否支持画中画（预留，当前四套均为 false） */
  pip?: boolean;
  /** 是否支持离屏继续播放（仅 EasyPlayer 实现） */
  keepPlayingOffscreen?: boolean;
}

// ============================================================
// 统计指标（统一单位）
// ============================================================

/**
 * 播放器统计指标。
 *
 * **单位约定（所有 adapter 必须遵守）：**
 * - `buf`  缓冲时长，单位 **毫秒 (ms)**，建议范围 `[0, 8000]`
 * - `fps`  帧率，单位 **帧/秒**，`0` 表示未知
 * - `abps` 音频码率，单位 **比特/秒 (bps)**，`0` 表示未知
 * - `vbps` 视频码率，单位 **比特/秒 (bps)**，`0` 表示未知
 * - `ts`   播放时间戳，单位 **秒 (s)**，与 `currentTime` 一致
 *
 * **数据真实性要求：**
 * adapter 未实现某指标时应保持 `undefined` 或 `0`，
 * **禁止填随机值/伪造数据**，由 UI 层显示"未知"。
 *
 * **向后兼容：**
 * 所有字段可选，旧 adapter 只填部分字段仍可工作。
 */
export interface PlayerStats {
  /** 缓冲时长 (ms)，`0` 表示无缓冲/未知 */
  buf?: number;
  /** 帧率 (fps)，`0` 表示未知 */
  fps?: number;
  /** 音频码率 (bps)，`0` 表示未知 */
  abps?: number;
  /** 视频码率 (bps)，`0` 表示未知 */
  vbps?: number;
  /** 播放时间戳 (s)，与 currentTime 一致 */
  ts?: number;
}

// ============================================================
// 截图选项
// ============================================================

/**
 * 截图参数。
 */
export interface ScreenshotOptions {
  /** 文件名（不含扩展名），未传时由 adapter 生成 */
  filename?: string;
  /** 图片格式，默认 `'png'` */
  format?: 'jpeg' | 'png' | 'webp';
  /** 返回类型，默认 `'base64'` */
  type?: 'base64' | 'blob' | 'download';
}

/**
 * 截图返回值。
 * - `type: 'base64'` → `string`（dataURL）
 * - `type: 'blob'`   → `Blob`
 * - `type: 'download'` 或无返回 → `undefined`
 */
export type ScreenshotResult = Blob | string | undefined;

// ============================================================
// 统一播放器接口
// ============================================================

/**
 * 播放器统一接口。
 *
 * 所有底层播放器的 Adapter 都必须实现此接口。
 * 所有 `Ref` 均为只读语义（adapter 内部可写，消费者只读）。
 *
 * **设计原则：**
 * 1. 同步方法只改状态，异步操作提供 `*Async` 可选方法
 * 2. 能力差异通过 `capabilities` 声明，可选方法按需实现
 * 3. 所有 `Ref` 在 `destroy()` 后保持最后一次值，**不置 null**
 *
 * **兼容性说明：**
 * - `setUrl` 保持 `void` 返回（历史契约），新实现可额外提供
 *   `setUrlAsync` 返回 Promise，调用方优先用 `setUrlAsync`
 * - 后续大版本将把 `setUrl` 改为 `Promise<void>`，
 *   届时 `setUrlAsync` 会被移除
 */
export interface IPlayerApi {
  // ===== 状态（只读）=====

  /** 是否正在播放 */
  isPlaying: Readonly<Ref<boolean>>;
  /** 是否正在加载 */
  isLoading: Readonly<Ref<boolean>>;
  /** 是否已就绪（底层已 load 成功且至少收到一次 videoInfo/ontrack） */
  isReady: Readonly<Ref<boolean>>;
  /** 错误信息，`null` 表示无错误 */
  error: Readonly<Ref<null | string>>;
  /** 音量，范围 `[0, 1]` */
  volume: Readonly<Ref<number>>;
  /** 是否静音 */
  isMuted: Readonly<Ref<boolean>>;
  /** 视频宽度（像素），`0` 表示未知 */
  videoWidth: Readonly<Ref<number>>;
  /** 视频高度（像素），`0` 表示未知 */
  videoHeight: Readonly<Ref<number>>;
  /** 当前播放时间 (s) */
  currentTime: Readonly<Ref<number>>;
  /** 网络延迟/缓冲 (ms)，与 `stats.buf` 同源，便捷访问 */
  networkDelay: Readonly<Ref<number>>;
  /** 是否正在录制 */
  isRecording: Readonly<Ref<boolean>>;
  /** 录制时长 (ms) */
  recordingDuration: Readonly<Ref<number>>;
  /** 缩放模式：0=拉伸填满，1=等比留黑边，2=等比裁切 */
  scaleMode: Readonly<Ref<0 | 1 | 2>>;
  /** 网络统计（单位见 `PlayerStats` 注释） */
  stats: Readonly<Ref<PlayerStats>>;

  // ===== 能力声明 =====

  /** 能力声明 */
  capabilities: PlayerCapabilities;

  // ===== 基础控制 =====

  /** 开始播放 */
  play: () => Promise<void>;
  /** 暂停播放 */
  pause: () => Promise<void>;
  /** 切换播放/暂停 */
  toggle: () => Promise<void>;
  /** 设置音量，范围 `[0, 1]`，超出裁剪 */
  setVolume: (v: number) => void;
  /** 设置静音 */
  setMuted: (m: boolean) => void;

  /**
   * 设置播放地址（历史契约，返回 `void`）。
   *
   * 语义：更新 store.url，重连由组件 watch 或底层 `restartPlayer` 触发。
   * 调用方无法 `await` 确认切换完成——若需此能力，请用 `setUrlAsync`。
   */
  setUrl: (url: string) => void;

  /**
   * 设置播放地址（异步契约，返回 `Promise`）。
   *
   * 语义：更新 store.url 并**等待重连完成或失败**。
   * - 可选方法；未实现的 adapter 调用方应 fallback 到 `setUrl` + `play`
   * - 新实现应优先提供此方法
   */
  setUrlAsync?: (url: string) => Promise<void>;

  /** 销毁播放器，释放所有资源 */
  destroy: () => Promise<void>;

  // ===== 全屏（统一入口）=====

  /** 请求全屏（可选，`capabilities.fullscreen` 为 `true` 时应实现） */
  requestFullscreen?: () => Promise<void>;
  /** 退出全屏（可选） */
  exitFullscreen?: () => Promise<void>;

  // ===== 可选控制（capabilities 决定是否可用）=====

  /** 跳转到指定时间 (s)，`capabilities.seek` 为 `true` 时应实现 */
  seek?: (t: number) => void;
  /** 重新计算尺寸（如容器尺寸变化后调用） */
  resize?: () => void;
  /** 截图，`capabilities.screenshot` 为 `true` 时应实现 */
  screenshot?: (opts?: ScreenshotOptions) => ScreenshotResult;
  /** 设置缩放模式，`capabilities.scaleMode` 为 `true` 时应实现 */
  setScaleMode?: (mode: 0 | 1 | 2) => void;
  /** 开始录制，`capabilities.record` 为 `true` 时应实现 */
  startRecord?: (name?: string, type?: string) => void;
  /** 停止录制并保存 */
  stopRecordAndSave?: () => void;

  // ===== 扩展（供特定场景使用，非契约要求）=====

  /** 设置加载状态（供组件层主动控制 loading） */
  setLoading?: (loading: boolean) => void;
  /** 更新播放状态（供组件层同步底层 video 事件） */
  updatePlaying?: (playing: boolean) => void;
  /** 更新加载状态（`setLoading` 别名） */
  updateLoading?: (loading: boolean) => void;

  // ===== 底层 video 访问（高级场景）=====

  /** 返回底层 video 元素；不支持或未绑定时返回 `null` */
  getVideoElement?: () => HTMLVideoElement | null;
}

// ============================================================
// 工具：统计归一化
// ============================================================

/**
 * 归一化 stats：裁剪范围、过滤 NaN/Infinity。
 *
 * - `buf` 裁剪到 `[0, 8000]`
 * - `fps` 裁剪到 `[0, 240]`
 * - `abps` / `vbps` 裁剪到 `[0, 1e9]`
 * - `ts` 裁剪到 `[0, Number.MAX_SAFE_INTEGER]`
 * - 任意字段为 `NaN` / `Infinity` 时置 `0`
 *
 * 纯函数，无副作用；四套 adapter 可选使用。
 *
 * @example
 * ```ts
 * normalizeStats({ buf: -5, vbps: Number.NaN, fps: 9999 });
 * // { buf: 0, fps: 240, abps: 0, vbps: 0, ts: 0 }
 * ```
 */
export function normalizeStats(
  raw: null | Partial<PlayerStats> | undefined,
): PlayerStats {
  const safe = (v: unknown, min: number, max: number): number => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
    return Math.min(max, Math.max(min, n));
  };
  return {
    buf: safe(raw?.buf, 0, 8000),
    fps: safe(raw?.fps, 0, 240),
    abps: safe(raw?.abps, 0, 1_000_000_000),
    vbps: safe(raw?.vbps, 0, 1_000_000_000),
    ts: safe(raw?.ts, 0, Number.MAX_SAFE_INTEGER),
  };
}

// ============================================================
// 工具：安全取消订阅
// ============================================================

/**
 * 安全取消订阅。
 *
 * 兼容三种返回形态：
 * 1. `{ unsubscribe: () => void }`（当前 `@vben-core/shared/store` 约定）
 * 2. `() => void`（函数式）
 * 3. `null | undefined`（未订阅/已取消）
 *
 * 参数用 `unknown` 避免 `player-types` 反向依赖 `@vben-core/shared`。
 *
 * @example
 * ```ts
 * const unsub = api.store.subscribe(...);
 * // 销毁时：
 * safeUnsubscribe(unsub);
 * ```
 */
export function safeUnsubscribe(sub: unknown): void {
  if (!sub) return;
  try {
    if (typeof sub === 'function') {
      sub();
    } else if (
      typeof sub === 'object' &&
      'unsubscribe' in sub &&
      typeof (sub as Record<string, unknown>).unsubscribe === 'function'
    ) {
      ((sub as Record<string, unknown>).unsubscribe as () => void)();
    }
  } catch (error) {
    console.warn('[player-types] safeUnsubscribe error:', error);
  }
}

// ============================================================
// 工具：帧率计数器
// ============================================================

/**
 * 帧率计数器：把"累计帧数"转为"实时帧率"。
 *
 * 用法：
 * ```ts
 * const fps = createFpsCounter();
 * // 每次拿到累计帧数时：
 * const current = fps.update(totalDecodedFrames); // 返回 fps
 * ```
 *
 * 内部用滑动窗口（默认 5 次采样）平滑，避免单次抖动。
 */
export function createFpsCounter(windowSize = 5) {
  const samples: Array<{ frames: number; time: number }> = [];
  return {
    update(totalFrames: number): number {
      const now = performance.now();
      samples.push({ frames: totalFrames, time: now });
      if (samples.length > windowSize) samples.shift();
      if (samples.length < 2) return 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      if (!first || !last) return 0;
      const dt = (last.time - first.time) / 1000;
      const df = last.frames - first.frames;
      if (dt <= 0 || df < 0) return 0;
      return Math.round(df / dt);
    },
    reset() {
      samples.length = 0;
    },
  };
}
