<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { ref } from 'vue';

import { Button, Empty, Input, message, SpaceCompact, Tag } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();
const city = ref('北京市');
const loading = ref(false);
const searched = ref(false); // 是否已查询过

const liveData = ref<any>(null);
const forecastData = ref<any[]>([]);

function queryWeather() {
  const AMap = props.api.getAMap();
  if (!AMap || !city.value) return;

  loading.value = true;
  liveData.value = null;
  forecastData.value = [];
  searched.value = false;

  // 加载天气插件
  AMap.plugin('AMap.Weather', () => {
    const weather = new AMap.Weather();

    // 实时天气
    weather.getLive(city.value, (err: any, data: any) => {
      if (!err) liveData.value = data;
    });

    // 天气预报（当天至第三天）
    weather.getForecast(city.value, (err: any, data: any) => {
      loading.value = false;
      if (!err && data.forecasts?.length) {
        forecastData.value = data.forecasts[0].casts || [];
      } else {
        message.warning('未获取到该城市天气');
      }
      // 标记为已查询
      searched.value = true;
    });
  });
}

function clear() {
  city.value = '';
  liveData.value = null;
  forecastData.value = [];
  searched.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 统一风格：输入 + 查询 + 清除 -->
    <SpaceCompact class="w-full">
      <Input
        v-model:value="city"
        placeholder="如：北京市"
        allow-clear
        class="h-8"
        @press-enter="queryWeather"
      />
      <Button
        type="primary"
        class="h-8 px-4"
        :loading="loading"
        @click="queryWeather"
      >
        {{ loading ? '查询中' : '查询' }}
      </Button>
      <Button v-if="searched" class="h-8" @click="clear"> 清空 </Button>
    </SpaceCompact>

    <!-- 实时天气展示 -->
    <div
      v-if="liveData"
      class="rounded border border-border bg-muted/20 p-2 text-sm"
    >
      <div class="flex items-center justify-between font-medium">
        <span>{{ liveData.city }} 实时天气</span>
        <Tag color="blue" class="!m-0">{{ liveData.weather }}</Tag>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-1 text-xs text-foreground/70">
        <span>温度：{{ liveData.temperature }}℃</span>
        <span>湿度：{{ liveData.humidity }}%</span>
        <span>风向：{{ liveData.windDirection }}</span>
        <span>风力：{{ liveData.windPower }}级</span>
      </div>
    </div>

    <!-- 天气预报列表 -->
    <div v-if="forecastData.length" class="flex flex-col gap-1">
      <div class="text-xs text-foreground/50">未来三天预报</div>
      <div
        v-for="item in forecastData"
        :key="item.date"
        class="flex items-center justify-between rounded border border-border/50 px-2 py-1 text-xs"
      >
        <span>{{ item.date }} {{ item.week }}</span>
        <span>{{ item.dayWeather }} {{ item.dayTemp }}° /
          {{ item.nightTemp }}°</span>
      </div>
    </div>

    <!-- 空状态（搜索过且无数据时展示） -->
    <Empty
      v-else-if="searched && !loading && !liveData"
      :image="Empty.PRESENTED_IMAGE_SIMPLE"
      description="未获取到该城市天气"
      class="!my-2"
    />
  </div>
</template>
