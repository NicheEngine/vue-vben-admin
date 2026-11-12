<script lang="ts" setup>
import type { IAmap2dApi, IAmap3dApi } from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { Button, message, Space } from 'antdv-next';

import CarMarker from '#/assets/images/car.png';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();

const planning = ref(false);
const isMoving = ref(false);
const isPaused = ref(false);

let driving: any = null;
let passedPolyline: any = null;
let carMarker: any = null;

function startPlan() {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;

  planning.value = true;

  // 🔥 每次规划前，先彻底清空上一次的残留
  clearAll();

  const start = [116.397, 39.892];
  const end = [116.483, 39.922];

  AMap.plugin(['AMap.Driving'], () => {
    driving = new AMap.Driving({
      map,
      policy: AMap.DrivingPolicy.LEAST_TIME,
    });
    driving.search(start, end, (status: string, result: any) => {
      if (status === 'complete') {
        const steps = result.routes[0].steps;
        const path: [number, number][] = [];
        steps.forEach((step: any) => {
          step.path.forEach((p: any) => path.push([p.lng, p.lat]));
        });
        message.success('路线规划完成，开始巡航');
        startCruise(AMap, map, path);
      } else {
        message.error('路线规划失败');
      }
      planning.value = false;
    });
  });
}

function startCruise(AMap: any, map: any, path: [number, number][]) {
  // 开始前清理旧的巡航数据（保留刚刚 driving 画出来的起终点和路线）
  clearCruiseGraphics();

  const startPoint = path[0];
  if (!startPoint) return;

  passedPolyline = new AMap.Polyline({
    map,
    strokeColor: '#22c55e',
    strokeWeight: 6,
  });

  carMarker = new AMap.Marker({
    map,
    position: startPoint,
    icon: CarMarker,
    offset: new AMap.Pixel(-13, -13),
    autoRotation: false,
  });

  carMarker.on('moving', (e: any) => {
    const currentPos = e.target.getPosition();
    let nextPoint: [number, number] | null = null;
    let minDistance = Infinity;

    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (!p) continue;

      const lngLat = new AMap.LngLat(p[0], p[1]);
      const dist = currentPos.distance(lngLat);

      if (dist > 5 && dist < 50 && dist < minDistance) {
        minDistance = dist;
        nextPoint = p;
      }
    }

    if (nextPoint) {
      const rad = Math.atan2(
        nextPoint[1] - currentPos.lat,
        nextPoint[0] - currentPos.lng,
      );
      const angle = (rad * 180) / Math.PI;
      e.target.setAngle(angle + 90);
    }
  });

  AMap.plugin('AMap.MoveAnimation', () => {
    carMarker.moveAlong(path, {
      duration: 100,
      lineToMove: passedPolyline,
    });
    isMoving.value = true;
    isPaused.value = false;
  });
}

function pause() {
  if (carMarker && isMoving.value && !isPaused.value) {
    carMarker.pauseMove();
    isPaused.value = true;
  }
}

function resume() {
  if (carMarker && isPaused.value) {
    carMarker.resumeMove();
    isPaused.value = false;
  }
}

// 🔥 提取清理自定义巡航图层的逻辑
function clearCruiseGraphics() {
  const map = props.api.getMapInstance();
  if (!map) return;

  if (carMarker) {
    map.remove(carMarker);
    carMarker = null;
  }
  if (passedPolyline) {
    map.remove(passedPolyline);
    passedPolyline = null;
  }
}

// 🔥 彻底清理所有（包含高德的规划结果）
function clearAll() {
  clearCruiseGraphics();

  if (driving) {
    driving.clear(); // 清除高德规划的起终点和原生路线
    driving = null;
  }

  isMoving.value = false;
  isPaused.value = false;
}

function stop() {
  if (carMarker) {
    carMarker.stopMove();
  }
  // 停止时调用彻底清理
  clearAll();
}

onBeforeUnmount(() => {
  clearAll();
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <Space wrap>
      <Button
        type="primary"
        size="small"
        :loading="planning"
        @click="startPlan"
      >
        {{ isMoving ? '重新规划' : '路线巡航' }}
      </Button>
      <Button size="small" :disabled="!isMoving || isPaused" @click="pause">
        暂停
      </Button>
      <Button size="small" :disabled="!isPaused" @click="resume">继续</Button>
      <Button size="small" danger :disabled="!isMoving" @click="stop">
        停止
      </Button>
    </Space>
  </div>
</template>
