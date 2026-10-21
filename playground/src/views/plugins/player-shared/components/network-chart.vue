<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    max?: number;
    color?: string;
    label?: string;
    unit?: string;
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

function recomputeMax() {
  const window = data.value.slice(-props.capacity);
  const peak = Math.max(props.max, ...window);
  const target = peak * 1.2;
  if (target > maxValue.value * 1.5) {
    maxValue.value = target;
    return;
  }
  maxValue.value = maxValue.value * 0.9 + target * 0.1;
}

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
    recomputeMax();
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

  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssWidth;
  const h = cssHeight;
  ctx.clearRect(0, 0, w, h);

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
