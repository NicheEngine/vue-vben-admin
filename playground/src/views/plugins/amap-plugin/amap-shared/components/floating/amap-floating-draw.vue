<script lang="ts" setup>
import type {
  IAmap2dApi,
  IAmap3dApi,
  OverlayRecord,
  OverlayType,
} from '@vben/amap';

import { onBeforeUnmount, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, message } from 'antdv-next';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();

const mode = ref<'edit' | 'none' | OverlayType>('none');
const activeEditingId = ref<null | string>(null);
let currentMouseTool: any = null;
let globalEditor: any = null;
let lastDrawnId: null | string = null;

const DRAW_MODES: Array<{ mode: OverlayType; icon: string; label: string }> = [
  { mode: 'marker', icon: 'mdi:map-marker', label: '点' },
  { mode: 'polyline', icon: 'mdi:vector-line', label: '线' },
  { mode: 'polygon', icon: 'mdi:vector-polygon', label: '面' },
  { mode: 'circle', icon: 'mdi:circle-outline', label: '圆' },
];

// 绘制
function startDraw(type: OverlayType) {
  stopEdit();
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;

  mode.value = type;
  lastDrawnId = null;

  if (!currentMouseTool) {
    currentMouseTool = new AMap.MouseTool(map);
    currentMouseTool.on('draw', (e: any) => {
      const overlay = e.obj;
      const currentType = mode.value as OverlayType;
      currentMouseTool.close(false);

      const record: OverlayRecord = {
        id: `${currentType}-${Date.now()}`,
        type: currentType,
        instance: overlay,
      };
      if (props.api.overlays && 'value' in props.api.overlays) {
        (props.api.overlays.value as any[]).push(record);
      }

      lastDrawnId = record.id;
      mode.value = 'edit';
      activeEditingId.value = record.id;

      if (currentType === 'marker') {
        overlay.setDraggable(true);
        message.success('点标记已添加');
      } else {
        setTimeout(() => openEditor(overlay), 100);
      }
    });
  }

  currentMouseTool.close(false);
  switch (type) {
    case 'marker': {
      currentMouseTool.marker();
      break;
    }
    case 'circle': {
      currentMouseTool.circle();
      break;
    }
    case 'polygon': {
      currentMouseTool.polygon();
      break;
    }
    case 'polyline': {
      currentMouseTool.polyline();
      break;
    }
  }
}

function openEditor(overlay: any) {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;
  if (overlay.CLASS_NAME.includes('Marker')) return;

  const type = overlay.CLASS_NAME;
  let pluginName = '';
  if (type.includes('Polygon')) pluginName = 'AMap.PolygonEditor';
  else if (type.includes('Polyline')) pluginName = 'AMap.PolylineEditor';
  else if (type.includes('Circle')) pluginName = 'AMap.CircleEditor';
  if (!pluginName) return;

  AMap.plugin([pluginName], () => {
    const EditorClass = (AMap as any)[pluginName.replace('AMap.', '')];
    if (!EditorClass) return;
    try {
      if (globalEditor) {
        globalEditor.close();
        if (globalEditor.CLASS_NAME === pluginName.replace('AMap.', '')) {
          globalEditor.setTarget(overlay);
          globalEditor.open();
          return;
        } else {
          globalEditor = null;
        }
      }
      globalEditor = new EditorClass(map, overlay);
      globalEditor.open();
    } catch (error) {
      console.warn(error);
    }
  });
}

function stopEdit() {
  if (globalEditor) {
    try {
      globalEditor.close();
    } catch (error) {
      console.warn(error);
    }
    globalEditor = null;
  }
  activeEditingId.value = null;
  mode.value = 'none';
}

function stopDraw() {
  if (currentMouseTool) currentMouseTool.close(false);
}

function handleSave() {
  stopDraw();
  stopEdit();
  lastDrawnId = null;
  message.success('已保存');
}

function handleCancel() {
  if (
    mode.value === 'edit' &&
    activeEditingId.value &&
    activeEditingId.value === lastDrawnId
  ) {
    const idToDelete = activeEditingId.value;
    stopEdit();
    props.api.removeOverlayById(idToDelete);
  } else {
    stopEdit();
  }
  stopDraw();
  lastDrawnId = null;
}

onBeforeUnmount(() => {
  stopEdit();
  if (currentMouseTool) {
    currentMouseTool.close(true);
    currentMouseTool = null;
  }
});
</script>

<template>
  <div class="flex flex-col gap-2 w-[220px]">
    <!-- 顶部的保存/取消栏 -->
    <div
      v-if="mode !== 'none'"
      class="flex items-center justify-between border-b border-border/30 pb-2"
    >
      <span class="text-xs text-blue-500 font-medium">{{
        mode === 'edit' ? '编辑中' : '绘制中'
      }}</span>
      <div class="flex gap-1">
        <Button
          size="small"
          type="primary"
          class="h-6 px-2 text-xs"
          @click="handleSave"
          >
保存
</Button>
        <Button
          size="small"
          type="text"
          class="h-6 px-2 text-xs text-foreground/70"
          @click="handleCancel"
        >
          取消
        </Button>
      </div>
    </div>

    <!-- 纯图标按钮组，每个宽高 40px，两列排布 -->
    <div class="grid grid-cols-4 gap-1.5">
      <button
        v-for="item in DRAW_MODES"
        :key="item.mode"
        class="flex flex-col items-center justify-center rounded-lg p-2 transition-all hover:bg-white/40 dark:hover:bg-white/10"
        :class="
          mode === item.mode
            ? 'bg-blue-500/20 text-blue-500'
            : 'text-gray-600 dark:text-gray-300'
        "
        @click="startDraw(item.mode)"
      >
        <IconifyIcon :icon="item.icon" class="text-lg mb-1" />
        <span class="text-[10px] leading-none">{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>
