import type {
  AutoPlayerType,
  ChooserInput,
  ChooserResult,
  EngineCandidate,
  EngineReady,
} from './types';

import { detectProtocol } from '@vben/player-types';

import { checkEngineReadySync } from './engine-ready';

/** 每个协议类的候选引擎优先级 */
const PRIORITY: Record<string, AutoPlayerType[]> = {
  webrtc: ['ossrs'],
  whep: ['ossrs'],
  'ws-flv': ['jessibuca', 'easy', 'live', 'ossrs'],
  'wss-flv': ['jessibuca', 'easy', 'live', 'ossrs'],
  'http-flv': ['jessibuca', 'easy', 'live', 'ossrs'],
  'https-flv': ['jessibuca', 'easy', 'live', 'ossrs'],
  hls: ['live', 'easy', 'ossrs'], // jessibuca 不支持 HLS
  unknown: ['live', 'easy', 'jessibuca', 'ossrs'],
};

/** 引擎展示名 */
export const ENGINE_LABELS: Record<AutoPlayerType, string> = {
  easy: 'EasyPlayer',
  jessibuca: 'Jessibuca',
  live: 'LivePlayer',
  ossrs: 'OSSRS',
};

/** 生成候选列表：按 URL 类别优先级排序，标记资源可用性 */
export function engineCandidates(
  url: string,
  ready: EngineReady = checkEngineReadySync(),
): EngineCandidate[] {
  const protocol = detectProtocol(url);
  const priority = PRIORITY[protocol] ?? PRIORITY.unknown ?? [];
  return priority.map((type) => ({
    type,
    label: ENGINE_LABELS[type],
    available: ready[type],
  }));
}

/** 安全取 chain 首个，空则用 fallback */
function firstOf(
  chain: AutoPlayerType[],
  fallback: AutoPlayerType,
): AutoPlayerType {
  return chain[0] ?? fallback;
}

/** 默认选择：候选里第一个"资源可用"的；全不可用则返回第一个 */
export function chooseEngine(
  input: ChooserInput,
  ready: EngineReady = checkEngineReadySync(),
): ChooserResult {
  const { url, forceType, isH265 } = input;

  if (forceType) {
    return {
      type: forceType,
      reason: `手动指定引擎: ${ENGINE_LABELS[forceType]}`,
      fallback: [],
    };
  }
  if (!url) {
    return { type: 'live', reason: '空 url，默认 live', fallback: [] };
  }

  const protocol = detectProtocol(url);

  // H265：仅 jessibuca / easy 支持（HLS+H265 时 jessibuca 不支持 HLS，走 easy）
  if (isH265) {
    const candidates =
      protocol === 'hls'
        ? (['easy'] as AutoPlayerType[])
        : (['jessibuca', 'easy'] as AutoPlayerType[]);
    const chain = candidates.filter((t) => ready[t]);
    // 即使都不可用，也强制返回候选首个，由 mountEngine 尝试；
    // 避免落空后走通用 priority 误选不支持 H265 的 live/ossrs
    const type = chain[0] ?? candidates[0] ?? 'easy';
    return {
      type,
      reason: `H265 → ${ENGINE_LABELS[type]}${
        chain.length === 0 ? '（资源未就绪，强制尝试）' : ''
      }`,
      fallback: chain.slice(1),
    };
  }

  const priority = PRIORITY[protocol] ?? PRIORITY.unknown ?? [];
  const available = priority.filter((t) => ready[t]);
  const chain = available.length > 0 ? available : priority;
  const type = firstOf(chain, 'live');

  return {
    type,
    reason: `${protocol} → ${ENGINE_LABELS[type]}`,
    fallback: chain.slice(1),
  };
}
