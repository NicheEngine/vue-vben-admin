<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { Button } from 'antdv-next';

const props = defineProps<{
  error: null | string;
  isReconnecting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
}>();

const countdown = ref(5);
let timer: null | ReturnType<typeof setInterval> = null;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startCountdown() {
  clearTimer();
  countdown.value = 5;
  timer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--;
    }
    if (countdown.value === 0) {
      clearTimer();
      emit('retry');
    }
  }, 1000);
}

// ✅ 统一通过 watch 管理定时器，避免时序问题
watch(
  () => props.error,
  (newError) => {
    if (newError) {
      startCountdown();
    } else {
      clearTimer();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<template>
  <div
    v-if="error"
    class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 p-6 text-white backdrop-blur-sm transition-all duration-300"
  >
    <div class="flex flex-col items-center max-w-md text-center">
      <!-- 错误图标 -->
      <div
        class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-8 w-8 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <!-- 错误标题与信息 -->
      <h3 class="mb-2 text-lg font-bold text-red-400">播放出错</h3>
      <p class="mb-6 text-sm text-white/80 break-words line-clamp-3">
        {{ error }}
      </p>

      <!-- 重试按钮 -->
      <Button
        type="primary"
        size="large"
        :loading="isReconnecting"
        @click="emit('retry')"
      >
        {{ isReconnecting ? '正在重连...' : `点击重试 (${countdown}s)` }}
      </Button>
    </div>
  </div>
</template>
