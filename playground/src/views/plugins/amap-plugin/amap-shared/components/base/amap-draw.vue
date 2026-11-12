<script lang="ts" setup>
import type {
  IAmap2dApi,
  IAmap3dApi,
  OverlayRecord,
  OverlayType,
} from '@vben/amap';

import { onBeforeUnmount, ref, watchEffect } from 'vue';

import { Button, message, Tag } from 'antdv-next';

import { convertOverlaysToGeoJSON, downloadJSON } from '../../utils';

const props = defineProps<{ api: IAmap2dApi | IAmap3dApi }>();

const mode = ref<'edit' | 'none' | OverlayType>('none');
const activeEditingId = ref<null | string>(null);
let currentMouseTool: any = null;
let globalEditor: any = null;
let lastDrawnId: null | string = null;

const DRAW_MODES: Array<{ mode: OverlayType; label: string }> = [
  { mode: 'marker', label: '点标记' },
  { mode: 'circle', label: '画圆' },
  { mode: 'polygon', label: '画多边形' },
  { mode: 'polyline', label: '画线' },
];

// ==================== 全局报错过滤 ====================
watchEffect(() => {
  // 🔥 捕获并屏蔽高德底层的 length undefined 报错
  window.addEventListener('error', (event) => {
    if (
      event.message?.includes(
        "Cannot read properties of undefined (reading 'length')",
      ) &&
      event.filename?.includes('maps?callback')
    ) {
      event.preventDefault(); // 阻止报错打印到控制台
    }
  });
});

// ==================== 绘制逻辑 ====================
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

// ==================== 列表选中与编辑 ====================
function selectOverlay(record: OverlayRecord) {
  mode.value = 'edit';
  activeEditingId.value = record.id;
  lastDrawnId = null;

  if (record.type === 'marker') {
    record.instance.setDraggable(true);
    message.success('点标记可拖拽');
    if (globalEditor) globalEditor.close();
    return;
  }

  openEditor(record.instance);
}

function openEditor(overlay: any) {
  const AMap = props.api.getAMap();
  const map = props.api.getMapInstance();
  if (!AMap || !map) return;

  if (overlay.CLASS_NAME.includes('Marker')) {
    overlay.setDraggable(true);
    return;
  }

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
      console.warn('编辑器初始化失败', error);
    }
  });
}

// ==================== 删除与清空 ====================
function removeOverlay(id: string) {
  if (activeEditingId.value === id) {
    stopEdit();
  }
  props.api.removeOverlayById(id);
  if (lastDrawnId === id) lastDrawnId = null;
}

function clearAll() {
  stopEdit();
  props.api.clearOverlays();
  lastDrawnId = null;
  message.success('已清空');
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
  if (currentMouseTool) {
    currentMouseTool.close(false);
  }
}

// ==================== 保存与取消 ====================
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
    message.info('已取消，当前绘制被移除');
  } else {
    stopEdit();
    message.info('已退出编辑');
  }
  stopDraw();
  lastDrawnId = null;
}

// ==================== 导出 ====================
function exportGeoJSON() {
  const overlays = props.api.overlays.value
    .map((o: any) => o.instance)
    .filter(Boolean);
  if (overlays.length === 0) {
    message.warning('地图上暂无图形可导出');
    return;
  }

  const geojson = convertOverlaysToGeoJSON(overlays);
  if (geojson.features.length === 0) {
    message.warning('无法解析当前图形，导出失败');
    return;
  }

  downloadJSON(geojson, `amap-shapes-${Date.now()}.geojson`);
  message.success('GeoJSON 导出成功');
}

onBeforeUnmount(() => {
  stopEdit();
  if (currentMouseTool) {
    currentMouseTool.close(true);
    currentMouseTool = null;
  }
});

defineExpose({
  mode,
  save: handleSave,
  cancel: handleCancel,
});
</script>

<template>
  <div class="relative flex flex-col">
    <!-- 顶部：绘制按钮组 -->
    <div class="flex flex-wrap gap-2">
      <Button
        v-for="item in DRAW_MODES"
        :key="item.mode"
        size="small"
        :type="mode === item.mode ? 'primary' : 'default'"
        @click="startDraw(item.mode)"
      >
        {{ item.label }}
      </Button>
    </div>

    <div class="my-3 h-px w-full bg-border/50"></div>

    <!-- 覆盖物列表集成区 -->
    <div class="flex flex-col gap-1">
      <div class="mb-1 text-xs text-foreground/50">覆盖物列表（点击编辑）</div>
      <div
        v-if="api.overlays.value.length === 0"
        class="py-1 text-xs text-foreground/40"
      >
        暂无图形，请在上方绘制
      </div>
      <div v-else class="max-h-[160px] space-y-1 overflow-y-auto pr-1">
        <div
          v-for="record in api.overlays.value"
          :key="record.id"
          class="flex cursor-pointer items-center justify-between rounded border px-2 py-1 text-xs transition-colors"
          :class="[
            activeEditingId === record.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent/50',
          ]"
          @click="selectOverlay(record)"
        >
          <span class="truncate">{{ record.type }} · {{ record.id }}</span>
          <Button
            size="small"
            type="text"
            danger
            class="h-6 px-1"
            @click.stop="removeOverlay(record.id)"
          >
            删除
          </Button>
        </div>
      </div>
    </div>

    <!-- 底部：右对齐的导出与清空按钮 -->
    <div
      class="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-3"
    >
      <Button size="small" @click="exportGeoJSON">导出 JSON</Button>
      <Button size="small" danger type="primary" ghost @click="clearAll">
        清空全部
      </Button>
    </div>

    <!-- 顶部绝对定位的保存/取消 -->
    <div
      v-if="mode !== 'none'"
      class="absolute -top-[42px] right-0 flex h-7 items-center gap-2"
    >
      <Tag color="processing" class="!m-0 !text-xs">
        {{ mode === 'edit' ? '编辑中' : '绘制中' }}
      </Tag>
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
</template>
