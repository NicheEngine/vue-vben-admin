# Vben Player 接入指南

## 1. 接入播放器

四个播放器（EasyPlayer, Jessibuca, LivePlayer, OSSRS）均已统一为标准接口。

### 示例：接入 LivePlayer

```vue
<script setup lang="ts">
import { useLivePlayer } from '@vben/live-player';
import { createLiveAdapter, PlayerSizeCard, PlayerControlCard } from '@vben/player-shared';

// 1. 创建实例
const [Player, api] = useLivePlayer({ ... });
// 2. 生成 Adapter
const player = createLiveAdapter(api);
</script>

<template>
  <PlayerSizeCard :player="player">
    <Player :url="currentUrl" />
  </PlayerSizeCard>
  <PlayerControlCard :player="player" />
</template>
```

## 2. 统一契约说明

- **状态同步**：`player.isPlaying` 等均为 `Ref`。
- **异步换流**：使用 `await player.setUrlAsync(url)` 处理 Loading 态。
- **能力声明**：使用 `player.capabilities.record` 决定是否展示录制按钮。
