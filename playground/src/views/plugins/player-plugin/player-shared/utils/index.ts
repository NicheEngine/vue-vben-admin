import { detectProtocol as detectPureProtocol } from '@vben/player-types';

/** 根据 URL 猜测流协议类型 */
export type StreamProtocol =
  | 'hls'
  | 'http-flv'
  | 'https-flv'
  | 'unknown'
  | 'webrtc'
  | 'whep'
  | 'ws-flv'
  | 'wss-flv';

export interface ProtocolInfo {
  protocol: StreamProtocol;
  label: string;
  color: string;
  description: string;
}

/** UI 层协议文案映射 */
const PROTOCOL_LABELS: Record<
  StreamProtocol,
  Omit<ProtocolInfo, 'protocol'>
> = {
  whep: {
    label: 'WHEP',
    color: 'blue',
    description: '标准 WebRTC 协议，需服务器支持 WHIP/WHEP',
  },
  webrtc: {
    label: 'SRS RTC',
    color: 'green',
    description: '超低延迟 WebRTC，需 SRS 服务器支持',
  },
  'ws-flv': {
    label: 'WebSocket-FLV',
    color: 'green',
    description: 'WebSocket 长连接，低延迟，推荐',
  },
  'wss-flv': {
    label: 'WSS-FLV',
    color: 'green',
    description: '加密 WebSocket 长连接，低延迟，推荐',
  },
  hls: {
    label: 'HLS',
    color: 'blue',
    description: '基于 HTTP/HTTPS 的 HLS，兼容性好，延迟较高',
  },
  'https-flv': {
    label: 'HTTPS-FLV',
    color: 'green',
    description: '基于 HTTPS 的 FLV，安全，推荐',
  },
  'http-flv': {
    label: 'HTTP-FLV',
    color: 'orange',
    description: '基于 HTTP 的 FLV，可能被浏览器拦截（混合内容）',
  },
  unknown: {
    label: '未知',
    color: 'default',
    description: '无法识别协议，请确认地址',
  },
};

/** UI 层：带文案的协议识别（包装 player-types 纯函数） */
export function detectProtocol(url: string): ProtocolInfo {
  const protocol = detectPureProtocol(url);
  return {
    protocol,
    ...(PROTOCOL_LABELS[protocol] ?? PROTOCOL_LABELS.unknown),
  };
}

/** 重导出 player-types 的 detectOssrsProtocol（纯逻辑，UI 无需包装） */
export { detectOssrsProtocol } from '@vben/player-types';

export function createDebounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
) {
  let timer: null | ReturnType<typeof setTimeout> = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export interface ProbeResult {
  ok: boolean;
  status?: number;
  contentType?: string;
  error?: string;
  mismatch?: boolean;
}

/**
 * 探测 URL 是否可访问。
 * GET + Range: bytes=0-0 只取首字节，5s 超时。
 */
export async function probeUrl(url: string): Promise<ProbeResult> {
  const protocol = detectProtocol(url).protocol;

  // WebRTC 和 WHEP 协议不能使用 GET 探测（不支持 fetch），直接返回可访问
  if (
    protocol === 'webrtc' ||
    protocol === 'whep' ||
    url.startsWith('webrtc://') ||
    url.startsWith('rtc://') ||
    url.includes('/whep/') ||
    url.includes('/whip-play/')
  ) {
    return {
      ok: true,
      status: 200,
      contentType: 'application/sdp',
      error: '',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    });

    const contentType = (resp.headers.get('content-type') ?? '').toLowerCase();
    const isFlv = protocol.includes('flv');
    const isHls = protocol === 'hls';

    void resp.body?.cancel();

    const mismatch =
      (isFlv &&
        !contentType.includes('flv') &&
        !contentType.includes('octet-stream')) ||
      (isHls &&
        !contentType.includes('mpegurl') &&
        !contentType.includes('text'));

    return { ok: resp.ok, status: resp.status, contentType, mismatch };
  } catch (error: any) {
    return {
      ok: false,
      error:
        error?.name === 'AbortError'
          ? '探测超时（5s）'
          : error?.message || '请求失败',
    };
  } finally {
    clearTimeout(timer);
  }
}
