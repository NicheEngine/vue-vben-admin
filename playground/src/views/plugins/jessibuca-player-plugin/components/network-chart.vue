<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 数值，比如 buf(ms) 或 kBps */
    value: number;
    /** 最大值（用于归一化） */
    max?: number;
    /** 颜色 */
    color?: string;
    /** 标题 */
    label?: string;
    /** 单位 */
    unit?: string;
    /** 保留多少帧 */
    capacity?: number;
  }>(),
  {
    max: 100,
    color: '#22c55e',
    label: '',
    unit: '',
    capacity: 120,
  },
);

const canvasRef = ref<HTMLCanvasElement>();
const data = ref<number[]>([]);
const maxValue = ref(props.max);

let observer: null | ResizeObserver = null;

watch(
  () => props.max,
  (v) => {
    maxValue.value = v;
    draw();
  },
);

watch(
  () => props.value,
  (v) => {
    if (typeof v !== 'number' || Number.isNaN(v)) return;
    data.value.push(v);
    if (data.value.length > props.capacity) data.value.shift();
    if (v > maxValue.value) maxValue.value = v * 1.2;
    draw();
  },
);

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth === 0 || cssHeight === 0) return;

  // 只在尺寸真正变化时重设并重置变换
  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
  }
  // 用 setTransform 替代 scale，避免累积缩放
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssWidth;
  const h = cssHeight;
  ctx.clearRect(0, 0, w, h);

  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (data.value.length < 2) return;

  const max = maxValue.value || 1;
  const step = w / (props.capacity - 1);

  // 折线
  ctx.strokeStyle = props.color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  data.value.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 面积填充
  ctx.fillStyle = `${props.color}33`;
  ctx.beginPath();
  ctx.moveTo(0, h);
  data.value.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    ctx.lineTo(x, y);
  });
  ctx.lineTo((data.value.length - 1) * step, h);
  ctx.closePath();
  ctx.fill();
}

onMounted(() => {
  draw();
  observer = new ResizeObserver(() => draw());
  if (canvasRef.value) observer.observe(canvasRef.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <div class="rounded-lg border border-border bg-muted/30 p-2">
    <div class="mb-1 flex items-center justify-between text-xs">
      <span class="text-foreground/70">{{ label }}</span>
      <span class="text-foreground/50">
        当前：{{ value.toFixed(1) }} {{ unit }} / 峰值：{{
          maxValue.toFixed(1)
        }}
        {{ unit }}
      </span>
    </div>
    <canvas ref="canvasRef" class="block h-[80px] w-full"></canvas>
  </div>
</template>
