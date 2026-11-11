<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '../core/types';

import { ref } from 'vue';

const props = defineProps<{
  api: IAmap2dApi | IAmap3dApi;
}>();

const keyword = ref('');
const results = ref<any[]>([]);
const loading = ref(false);
const searched = ref(false);
const errorMsg = ref('');

async function handleSearch() {
  const kw = keyword.value.trim();
  if (!kw) return;

  loading.value = true;
  errorMsg.value = '';
  results.value = [];
  try {
    results.value = await props.api.searchPOI(kw);
    searched.value = true;
  } catch (error: any) {
    errorMsg.value = error?.message || '搜索失败';
  } finally {
    loading.value = false;
  }
}

function selectPlace(poi: any) {
  const pos: [number, number] = [poi.location.lng, poi.location.lat];
  props.api.setCenter(pos);
  props.api.setZoom(17);
}

function clear() {
  keyword.value = '';
  results.value = [];
  searched.value = false;
  errorMsg.value = '';
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索地点..."
        class="flex-1 rounded border border-input bg-background px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        @keyup.enter="handleSearch"
      />
      <button
        class="rounded bg-primary px-4 py-1 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        :disabled="loading"
        @click="handleSearch"
      >
        {{ loading ? '搜索中' : '搜索' }}
      </button>
      <button
        v-if="searched"
        class="rounded border border-border bg-accent px-3 py-1 text-sm text-foreground hover:bg-accent-foreground/10"
        @click="clear"
      >
        清空
      </button>
    </div>

    <p v-if="errorMsg" class="text-xs text-destructive">{{ errorMsg }}</p>

    <ul
      v-if="results.length > 0"
      class="max-h-60 overflow-y-auto rounded border border-border bg-card text-sm shadow-sm"
    >
      <li
        v-for="poi in results"
        :key="poi.id"
        class="cursor-pointer border-b border-border px-3 py-2 transition-colors last:border-0 hover:bg-accent"
        @click="selectPlace(poi)"
      >
        <div class="font-medium text-foreground">{{ poi.name }}</div>
        <div class="text-xs text-muted-foreground">{{ poi.address }}</div>
      </li>
    </ul>
    <p
      v-else-if="searched && !loading && !errorMsg"
      class="text-xs text-muted-foreground"
    >
      未找到相关地点
    </p>
  </div>
</template>
