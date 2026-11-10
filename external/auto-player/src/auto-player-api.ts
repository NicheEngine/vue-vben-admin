import type { IPlayerApiFull } from '@vben/player-types';

import type {
  AutoPlayerOptions,
  AutoPlayerType,
  ChooserResult,
  EngineCandidate,
} from './types';

import { reactive, ref, shallowRef, watch } from 'vue';

import { createEasyAdapter } from '@vben/easy-player';
import { createJessibucaAdapter } from '@vben/jessibuca-player';
import { createLiveAdapter } from '@vben/live-player';
import { createOssrsAdapter } from '@vben/ossrs-player';
import { detectOssrsProtocol, normalizeStats } from '@vben/player-types';

import { chooseEngine, engineCandidates } from './chooser';
import { checkEngineReadySync, waitEngineReady } from './engine-ready';

type EngineFactory = {
  create: (opts: {
    url: string;
    muted: boolean;
    autoplay: boolean;
    isH265: boolean;
  }) => Promise<{
    adapter: IPlayerApiFull;
    component: any;
    rawApi: any;
    destroyApi: () => Promise<void>;
  }>;
};

const factories: Record<AutoPlayerType, EngineFactory> = {
  easy: {
    async create({ url, muted }) {
      const { useEasyPlayer } = await import('@vben/easy-player');
      const [Component, api] = useEasyPlayer({
        videoUrl: url,
        muted,
        autoplay: true,
      });
      const adapter = createEasyAdapter(api);
      return {
        adapter,
        component: Component,
        rawApi: api,
        destroyApi: async () => {
          await adapter.destroy();
          api.destroy();
        },
      };
    },
  },
  jessibuca: {
    async create({ url, muted, isH265 }) {
      const { useJessibucaPlayer } = await import('@vben/jessibuca-player');
      const [Component, api] = useJessibucaPlayer({
        initialUrl: url,
        initialConfig: { isMute: muted, isH265 },
      });
      const adapter = createJessibucaAdapter(api);
      return {
        adapter,
        component: Component,
        rawApi: api,
        destroyApi: async () => {
          await adapter.destroy();
          await api.destroy();
        },
      };
    },
  },
  live: {
    async create({ muted }) {
      const { useLivePlayer } = await import('@vben/live-player');
      const [Component, api] = useLivePlayer({ muted, autoplay: true });
      const adapter = createLiveAdapter(api);
      return {
        adapter,
        component: Component,
        rawApi: api,
        destroyApi: async () => {
          await adapter.destroy();
          api.destroy();
        },
      };
    },
  },
  ossrs: {
    async create({ url, muted, autoplay }) {
      const { useOssrsPlayer } = await import('@vben/ossrs-player');
      const protocol = detectOssrsProtocol(url) === 'whep' ? 'whep' : 'rtc';
      const [Component, api] = useOssrsPlayer({
        initialUrl: url,
        initialState: { muted, autoplay, url },
        initialProtocol: protocol,
      });
      const adapter = createOssrsAdapter(api);
      return {
        adapter,
        component: Component,
        rawApi: api,
        destroyApi: async () => {
          await adapter.destroy();
          api.destroy();
        },
      };
    },
  },
};

export class AutoPlayerApi {
  capabilities = reactive({
    screenshot: true,
    record: true,
    scaleMode: true,
    stats: true,
    seek: false,
    fullscreen: true,
    pip: true,
    keepPlayingOffscreen: false,
  });

  readonly componentRef = shallowRef<any>(null);
  readonly currentTime = ref(0);
  readonly engineTypeRef = shallowRef<AutoPlayerType | null>(null);
  readonly error = ref<null | string>(null);
  readonly isLoading = ref(false);
  readonly isMuted = ref(true);
  readonly isPlaying = ref(false);
  readonly isReady = ref(false);
  readonly isRecording = ref(false);
  readonly networkDelay = ref(0);
  readonly recordingDuration = ref(0);
  readonly scaleMode = ref<0 | 1 | 2>(1);
  readonly stats = ref(normalizeStats(null));
  readonly videoHeight = ref(0);
  readonly videoWidth = ref(0);
  readonly volume = ref(1);

  private adapter: IPlayerApiFull | null = null;
  private chooserResult: ChooserResult | null = null;
  private destroyApi: (() => Promise<void>) | null = null;
  private engineChangeCbs = new Set<(t: AutoPlayerType) => void>();
  private generation = 0;
  private isH265 = false;
  private rawApi: any = null;
  private syncUnsub: (() => void) | null = null;
  private url = '';

  constructor(private options: AutoPlayerOptions = {}) {
    this.url = options.initialUrl ?? '';
    this.isH265 = options.isH265 ?? false;
    this.isMuted.value = options.muted ?? true;
    this.scaleMode.value = options.scaleMode ?? 1;
  }

  async clear() {
    if (!this.adapter) return;
    const currentAdapter = this.adapter;

    try {
      await (currentAdapter.clear?.() ?? (await currentAdapter.pause()));
    } catch (error) {
      console.warn('[AutoPlayer] clear ignored:', error);
    }
  }

  async destroy(): Promise<void> {
    this.generation++;
    this.stopSync();
    this.engineChangeCbs.clear();
    if (this.destroyApi) {
      try {
        await this.destroyApi();
      } catch (error) {
        console.warn('[AutoPlayer] destroy failed', error);
      }
    }
    this.adapter = null;
    this.rawApi = null;
    this.destroyApi = null;
    this.componentRef.value = null;
    this.engineTypeRef.value = null;
  }

  async exitFullscreen() {
    await this.adapter?.exitFullscreen?.();
  }

  getAdapter(): IPlayerApiFull | null {
    return this.adapter;
  }

  getCandidates(): EngineCandidate[] {
    return engineCandidates(this.url);
  }

  getChooserResult(): ChooserResult | null {
    return this.chooserResult;
  }

  getComponent(): any {
    return this.componentRef.value;
  }

  getEngineType(): AutoPlayerType | null {
    return this.engineTypeRef.value;
  }

  getRawApi(): any {
    return this.rawApi;
  }

  getVideoElement() {
    return this.adapter?.getVideoElement?.() ?? null;
  }

  async init(url?: string): Promise<void> {
    const target = url ?? this.url;
    if (target) this.url = target;
    if (!this.url) return;

    const ready = checkEngineReadySync();
    const result = chooseEngine(
      {
        url: this.url,
        forceType: this.options.initialType,
        isH265: this.isH265,
        latency: this.options.latency,
      },
      ready,
    );
    this.chooserResult = result;
    const chain = [result.type, ...result.fallback];
    for (const type of chain) {
      const syncReady = checkEngineReadySync()[type];
      const ok = syncReady || (await waitEngineReady(type, 2000));
      if (!ok) continue;
      try {
        await this.mountEngine(type);
        return;
      } catch (error) {
        console.warn(`[AutoPlayer] mount ${type} failed`, error);
      }
    }
    this.error.value = '无可用播放器引擎';
  }

  onEngineChange(cb: (t: AutoPlayerType) => void): () => void {
    this.engineChangeCbs.add(cb);
    return () => this.engineChangeCbs.delete(cb);
  }

  async pause() {
    await this.adapter?.pause();
  }

  async play() {
    await this.adapter?.play();
  }

  async reload() {
    this.error.value = null;
    this.isLoading.value = true;
    if (this.adapter?.reload) return this.adapter.reload();
    if (this.url) {
      this.adapter?.setUrl(this.url);
      await this.adapter?.play();
    }
  }

  async requestFullscreen() {
    await this.adapter?.requestFullscreen?.();
  }

  async reset() {
    this.generation++; // 阻断旧的回调
    this.stopSync();
    if (this.destroyApi) {
      try {
        await this.destroyApi();
      } catch (error) {
        console.warn('[AutoPlayer] reset failed:', error);
      }
    }
    this.adapter = null;
    this.rawApi = null;
    this.destroyApi = null;
    this.componentRef.value = null;
    this.engineTypeRef.value = null;
    this.url = '';

    this.isPlaying.value = false;
    this.isLoading.value = false;
    this.isReady.value = false;
    this.isRecording.value = false;
    this.error.value = null;
    this.stats.value = normalizeStats(null);
    this.currentTime.value = 0;
  }

  resize() {
    this.adapter?.resize?.();
  }

  async retry() {
    this.error.value = null;
    this.isLoading.value = true;
    const ready = checkEngineReadySync();
    const result = chooseEngine(
      {
        url: this.url,
        forceType: this.options.initialType,
        isH265: this.isH265,
        latency: this.options.latency,
      },
      ready,
    );
    this.chooserResult = result;
    if (result.type !== this.engineTypeRef.value) {
      await this.mountEngine(result.type);
    } else if (this.adapter?.retry) {
      await this.adapter.retry();
    } else {
      this.adapter?.setUrl(this.url);
      await this.adapter?.play();
    }
  }

  screenshot(opts?: any) {
    return this.adapter?.screenshot?.(opts);
  }

  seek(t: number) {
    this.adapter?.seek?.(t);
  }

  setControlBarVisible(visible: boolean) {
    this.adapter?.setControlBarVisible?.(visible);
  }

  setLoading(loading: boolean) {
    this.isLoading.value = loading;
    this.adapter?.setLoading?.(loading);
  }

  setMuted(m: boolean) {
    this.isMuted.value = m;
    this.adapter?.setMuted(m);
  }

  setScaleMode(mode: 0 | 1 | 2) {
    this.scaleMode.value = mode;
    this.adapter?.setScaleMode?.(mode);
  }

  setUrl(url: string) {
    this.url = url;
    if (!this.adapter) {
      void this.init(url);
      return;
    }
    this.adapter.setUrl(url);
  }

  async setUrlAsync(url: string) {
    this.url = url;
    if (!this.adapter) {
      // 首次：初始化引擎。url 由组件挂载后通过 props 加载，不在此调 play。
      await this.init(url);
      return;
    }
    await this.adapter.setUrlAsync?.(url);
  }

  setVolume(v: number) {
    this.volume.value = Math.min(1, Math.max(0, v));
    this.adapter?.setVolume(v);
  }

  startRecord(name?: string, type?: string) {
    if (!this.adapter) {
      this.error.value = '播放器未初始化，无法录制';
      return;
    }
    if (!this.adapter.startRecord) {
      this.error.value = '当前播放器不支持录制';
      return;
    }
    try {
      this.adapter.startRecord(name, type);

      // 兜底：确保 UI 能响应（使用箭头函数保持 this 上下文）
      setTimeout(() => {
        if (this.adapter && !this.isRecording.value) {
          this.isRecording.value = true;
          this.recordingDuration.value = 0;
        }
      }, 300);
    } catch (error: any) {
      console.warn('[AutoPlayer] 开始录制异常:', error);
      this.error.value = error?.message || '开始录制失败';
    }
  }

  stopRecordAndSave() {
    if (!this.adapter?.stopRecordAndSave) return;
    try {
      this.adapter.stopRecordAndSave();
      setTimeout(() => {
        if (this.isRecording.value) {
          this.isRecording.value = false;
        }
      }, 300);
    } catch (error) {
      console.warn('[AutoPlayer] 停止录制异常:', error);
    }
  }

  async switchType(type: AutoPlayerType): Promise<void> {
    if (type === this.engineTypeRef.value) return;
    if (!checkEngineReadySync()[type]) {
      console.warn(`[AutoPlayer] engine ${type} not ready, switch ignored`);
      return;
    }
    await this.mountEngine(type);
  }

  async toggle() {
    await this.adapter?.toggle();
  }

  async togglePiP() {
    await this.adapter?.togglePiP?.();
  }

  private async mountEngine(type: AutoPlayerType): Promise<void> {
    const gen = ++this.generation;
    this.stopSync();
    if (this.destroyApi) {
      try {
        await this.destroyApi();
      } catch (error) {
        console.warn('[AutoPlayer] destroy old engine failed', error);
      }
    }
    this.adapter = null;
    this.rawApi = null;
    this.engineTypeRef.value = null;
    this.componentRef.value = null;
    this.destroyApi = null;

    const factory = factories[type];
    const { adapter, component, rawApi, destroyApi } = await factory.create({
      url: this.url,
      muted: this.isMuted.value,
      autoplay: this.options.autoplay ?? true,
      isH265: this.isH265,
    });

    if (gen !== this.generation) {
      await destroyApi();
      return;
    }

    this.adapter = adapter;
    this.rawApi = rawApi;
    this.engineTypeRef.value = type;
    this.componentRef.value = component;
    this.destroyApi = destroyApi;

    Object.assign(this.capabilities, adapter.capabilities);

    // 强制底层先应用静音，再开始同步
    adapter.setMuted(this.isMuted.value);
    adapter.setVolume(this.volume.value);
    adapter.setScaleMode?.(this.scaleMode.value);

    setTimeout(() => {
      if (gen === this.generation && this.adapter) {
        this.adapter.setMuted(this.isMuted.value);
      }
    }, 150);

    this.startSync(adapter, gen);

    this.engineChangeCbs.forEach((cb) => cb(type));
  }

  private startSync(adapter: IPlayerApiFull, gen: number): void {
    let isFirstSync = true; // 标记是否为第一次同步

    const sync = () => {
      if (gen !== this.generation) return;

      // 1. 同步除静音外的所有常规状态
      this.isPlaying.value = adapter.isPlaying.value;
      this.isLoading.value = adapter.isLoading.value;
      this.isReady.value = adapter.isReady.value;
      this.error.value = adapter.error.value;
      this.volume.value = adapter.volume.value;
      this.videoWidth.value = adapter.videoWidth.value;
      this.videoHeight.value = adapter.videoHeight.value;
      this.currentTime.value = adapter.currentTime.value;
      this.networkDelay.value = adapter.networkDelay.value;
      this.isRecording.value = adapter.isRecording.value;
      this.recordingDuration.value = adapter.recordingDuration.value;
      // this.scaleMode.value = adapter.scaleMode.value;
      this.stats.value = adapter.stats.value;

      // 2. 处理静音状态
      if (isFirstSync) {
        // 首次同步：我们已经在 mountEngine 里强推了 isMuted，这里拒绝底层的旧值覆盖
        // 如果底层还是 false 而我们要 true，再补一刀
        if (this.isMuted.value && !adapter.isMuted.value) {
          adapter.setMuted(true);
        }
      } else {
        // 非首次同步：完全信任底层状态（比如用户手动点击了静音，底层变了，UI 跟着变）
        if (this.isMuted.value !== adapter.isMuted.value) {
          this.isMuted.value = adapter.isMuted.value;
        }
      }

      // 3. 状态自愈：有画面/播放成功时，强制清除 loading 和 error
      if (this.isPlaying.value || this.isReady.value) {
        this.isLoading.value = false;
        this.error.value = null;
      }
    };

    sync();
    isFirstSync = false; // 首次同步结束

    const stops = [
      watch(adapter.isPlaying, sync),
      watch(adapter.isLoading, sync),
      watch(adapter.isReady, sync),
      watch(adapter.error, sync),
      watch(adapter.volume, sync),
      watch(adapter.isMuted, sync), // 后续底层变化会被同步
      watch(adapter.videoWidth, sync),
      watch(adapter.videoHeight, sync),
      watch(adapter.currentTime, sync),
      watch(adapter.networkDelay, sync),
      watch(adapter.isRecording, sync),
      watch(adapter.recordingDuration, sync),
      watch(adapter.scaleMode, sync),
      watch(adapter.stats, sync, { deep: true }),
    ];
    this.syncUnsub = () => stops.forEach((s) => s());
  }

  private stopSync(): void {
    this.syncUnsub?.();
    this.syncUnsub = null;
  }
}
