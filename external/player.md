# Vben 播放器统一架构 (Player Unified Architecture) 技术说明

## 1. 架构层级对比

在重构之前，四套播放器各自为战，状态维护与 UI 渲染耦合严重。重构后，我们确立了严格的单向数据流与三层架构标准：

```text
┌─────────────────────────────────────────────────────┐
│ XxxPlayer.vue (DOM 挂载、原生事件桥接、动态尺寸监听) │
├─────────────────────────────────────────────────────┤
│ XxxPlayerApi (底层引擎驱动、核心状态 Store、重试逻辑) │
├─────────────────────────────────────────────────────┤
│ createXxxAdapter (统一 IPlayerApi 契约，供 UI 消费) │
└─────────────────────────────────────────────────────┘
```

| 播放器 | 底层引擎 | Api 层成熟度 | 整体评价 |
| :-- | :-- | :-- | :-- |
| EasyPlayer | Video.js (Web Component) | ⭐⭐⭐⭐ | 兼容了历史遗留问题，DOM 极其复杂，需强穿透。 |
| Jessibuca | WASM (Canvas 渲染) | ⭐⭐⭐⭐⭐ | 纯 JS 解码，无原生 `<video>`，全屏与生命周期需特殊处理。 |
| LivePlayer | hls.js + mpegts.js | ⭐⭐⭐⭐⭐ | 代码最规范，原生 `<video>` 支持最完善，无痛接入。 |
| OSSRS | WebRTC (SRS SDK) | ⭐⭐⭐⭐ | 基于 `playToken` 防竞态，WebRTC 原生 API 需注意安全上下文。 |

## 2. 能力矩阵对比 (Capabilities)

通过暴露 `player.capabilities`，UI 层可按需渲染对应的功能按钮，彻底解决“点击无反应”的体验痛点。

| 能力 | EasyPlayer | Jessibuca | LivePlayer | OSSRS (WebRTC) |
| :-- | :-- | :-- | :-- | :-- |
| 协议支持 | HTTP-FLV / HLS | HTTP-FLV / WS-FLV / HLS | HLS / HTTP-FLV / WS-FLV | WebRTC / WHEP (+ Oryx) |
| 延迟 | 中（1-3s） | 中（0.5-2s） | 中（HLS 3-6s / FLV 1-2s） | 极低（<500ms） |
| 截图 | ✅ 支持 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| 录制 | ⚠️ Canvas（无音轨） | ✅ 实例内置（含音轨） | ⚠️ captureStream（依赖 CORS） | ⚠️ Canvas（无音轨） |
| 缩放模式 | ✅ 强制样式穿透 | ✅ 实例 setScaleMode | ✅ video.style.objectFit | ✅ video.style.objectFit |
| seek（进度条） | ❌ 直播流 | ❌ 直播流 | ❌ 直播流 | ❌ 直播流 |
| 网络统计 | ✅ 源码级 DOM 抓取 | ✅ 实例 stats 事件 | ✅ HLS/mpegts 真实统计 | ✅ WebRTC getStats |
| 全屏 | ✅ 支持 | ✅ 支持（官方 API） | ✅ 支持 | ✅ 支持 |
| 画中画 (PiP) | ✅ 原生 API | ❌ WASM 渲染不支持 | ✅ 原生 API | ✅ 原生 API |
| 状态标签显隐 | ✅ 新增控制 | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 |
| 控制栏显隐 | ✅ 新增控制 | ❌ 实例自带不可控 | ❌ 实例自带不可控 | ❌ 实例自带不可控 |
| 异常兜底与重试 | ✅ 统一防抖 | ✅ 统一防抖 | ✅ 统一防抖 | ✅ 统一防抖 |

## 3. 状态管理对比

设计原则：`isReady`、`isPlaying` 等核心状态完全下沉至底层 `Store`，Adapter 仅做单向的只读映射（`Ref`）。

| 状态字段 | 含义与规范 | 触发时机 |
| :-- | :-- | :-- |
| `isPlaying` | 是否正在播放 | 底层 `video` 触发 `play` / `pause` 事件时改变。 |
| `isLoading` | 是否处于加载中 | 换流时置为 `true`，收到 `videoInfo` 或 `playing` 时置为 `false`。 |
| `isReady` | 是否真正出画面就绪 | 收到 `loadedmetadata` (Easy)、`videoInfo` (Jess) 或 `ontrack` (OSSRS) 时才为 `true`；换流时立即为 `false`。 |
| `error` | 错误信息 | 底层抛出致命异常时，通过统一的 `handleError` 防抖后写入。 |
| `stats` | 码率、帧率、延迟 | 统一经过 `normalizeStats` 标准化处理（详见下文）。 |

## 4. 订阅与回调对比

为了确保 UI 层的状态绝对准确，我们对四套播放器的底层事件模型进行了统一：

EasyPlayer / LivePlayer / OSSRS：通过监听原生 `<video>` 元素的 `play`、`pause`、`timeupdate` 等事件，或者监听 HLS 实例的 `MANIFEST_PARSED` 事件来驱动。

Jessibuca：由于没有原生 `<video>`，改为劫持其实例底层的 `on('play')` 等事件，主动写入 `Store`。

性能优化：统一使用了基于 `prevState` 的对比机制，只有当状态真正发生改变时才触发回调，避免高频事件（如 `timeupdate` 每秒触发多次）导致的 UI 假死。

防抖重连：统一接入了 `handleError` 拦截器（2 秒窗口期），成功拦截了底层网络抖动、WebRTC `disconnected` 时疯狂报错导致 UI 弹窗闪烁的问题。

## 5. 底层引擎驱动对比

针对不同引擎的物理特性，我们在 Adapter 层做了定制化的底层黑科技：

| 播放器 | 特殊驱动与适配方案 |
| :-- | :-- |
| EasyPlayer | 码率获取：绕过不准确的 `hls.js` 估算，通过源码分析直接读取 `.vjs-bitrate-control` 的真实文本。<br>离屏播放：利用 `IntersectionObserver` 与重写 `pause` 事件双保险，防止被底层挂起。 |
| Jessibuca | 全屏重绘：放弃原生 DOM 全屏，调用其官方的 `setFullscreen()` API，防止画面不重绘。 |
| LivePlayer | 会话防抖：利用 `sessionId` 递增，在 `refresh()` 时抛弃所有旧的异步回调。 |
| OSSRS | 竞态处理：利用 `playToken` 标记当前连接代次，防止旧连接延迟回调污染新流。 |

## 6. API 使用说明 (业务接入指南)

所有播放器现在均实现 `IPlayerApi` 标准契约。业务方只需掌握如下几个核心步骤即可接入任何流媒体：

### 1. 实例化与 Adapter 绑定

```typescript
import { useEasyPlayer } from '@vben/easy-player';
import { createEasyAdapter } from '@vben/player-shared';

const [Player, api] = useEasyPlayer({ autoplay: true, muted: true });
const player = createEasyAdapter(api);
```

### 2. 消费响应式状态 (UI 层)

```vue
<template>
  <div>当前延迟: {{ player.networkDelay.value }} ms</div>
  <div>是否就绪: {{ player.isReady.value ? '是' : '否' }}</div>
</template>
```

### 3. 标准控制方法

```typescript
// 播放控制
await player.play();
await player.pause();

// 换流（支持 await 等待加载完成）
await player.setUrlAsync('http://test.com/live.m3u8');

// 音量、静音、缩放
player.setVolume(0.5);
player.setMuted(true);
player.setScaleMode(2); // 0=拉伸，1=留边，2=裁剪

// 画中画 (注意判断 capability)
if (player.capabilities.pip) {
  await player.togglePiP();
}
```

### 4. 统计指标标准化 (`PlayerStats`)

无论底层是哪个播放器，UI 层拿到的 `stats` 数据单位绝对统一：

`buf`：缓冲延迟（毫秒）

`fps`：帧率（帧/秒）

`vbps`：视频码率（比特/秒）

`abps`：音频码率（比特/秒）

`ts`：播放时间戳（秒）

注：数据由底层上报后，会经过 `normalizeStats` 函数统一裁断，防止出现 `NaN` 或无限大等导致图表崩溃的异常值。
