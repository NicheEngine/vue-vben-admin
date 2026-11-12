<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

export interface DockItem {
  key: string;
  icon: string;
  label: string;
}

const props = defineProps<{
  items: DockItem[];
  api?: any;
}>();

const activeKey = ref<null | string>(null);

function toggle(key: string) {
  activeKey.value = activeKey.value === key ? null : key;
}

function handleMapClick() {
  if (activeKey.value) activeKey.value = null;
}

let mapInstance: any = null;
watch(
  () => props.api?.isReady?.value,
  (ready) => {
    if (ready && props.api) {
      mapInstance = props.api.getMapInstance();
      if (mapInstance) mapInstance.on('click', handleMapClick);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.off('click', handleMapClick);
  }
});
</script>

<template>
  <div
    class="pointer-events-none absolute right-4 top-4 z-[100] flex items-start gap-3"
  >
    <!-- 弹出的面板区域 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-x-4 opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-4 opacity-0"
    >
      <div
        v-if="activeKey"
        class="pointer-events-auto max-h-[80vh] w-[260px] overflow-y-auto rounded-xl border border-border/50 bg-white/70 p-3 shadow-2xl backdrop-blur-2xl dark:border-gray-600/30 dark:bg-black/40"
      >
        <slot :name="activeKey" :close="() => (activeKey = null)"></slot>
      </div>
    </Transition>

    <!-- 极简图标坞 -->
    <div
      class="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/30 p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-black/30"
    >
      <button
        v-for="item in items"
        :key="item.key"
        class="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 hover:scale-105 hover:bg-white/50 dark:hover:bg-white/10"
        :class="
          activeKey === item.key
            ? 'bg-blue-500/90 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
            : 'text-gray-700 dark:text-gray-300'
        "
        :title="item.label"
        @click="toggle(item.key)"
      >
        <IconifyIcon :icon="item.icon" class="text-xl" />

        <!-- Tooltip -->
        <span
          class="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md bg-black/80 px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-white/20"
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </div>
</template>
